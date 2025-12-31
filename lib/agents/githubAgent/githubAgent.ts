
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { AgentUserRole, ON_CHAT_MODEL_STREAM_EVENT, AGENT_STARTED, AGENT_ENDED, AGENT_STREAM, AGENT_ERROR, TOOL_ENDED, TOOL_STARTED, TOOL_STARTED_EVENT, TOOL_ENDED_EVENT } from "@/lib/constants";
import { AgentChatMessage, LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { GitHubAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllGitHubMCPTools } from "./tools";

class GitHubAgent extends BaseAgent<LLMImplMetadata> {

    /**
     * @param githubAgentConfig GitHub agent configuration
     */
    constructor(githubAgentConfig: AgentConfig<LLMImplMetadata>) {
        super(githubAgentConfig);

        // Create all GitHub MCP tools (individual tools for each operation)
        this.agentTools = createAllGitHubMCPTools();

        // Use factory method to create LLM based on config provider
        console.log(`[GitHubAgent] Initializing with provider: ${this.implementationMetadata.provider}`);
        const llm = this.createLLMFromConfig();
        this.agentLLM = llm.bindTools!(this.agentTools);

        // Create tool node for executing tools
        const toolNode = new ToolNode(this.agentTools);

        // Build the agent graph
        const githubAgentGraph = new StateGraph(MessagesAnnotation)
            .addNode("GitHubAgentNode", this.agentNode.bind(this))
            .addNode("tools", toolNode)
            .addEdge(START, "GitHubAgentNode")
            .addConditionalEdges("GitHubAgentNode", this.GitHubAgentRoute.bind(this))
            .addEdge("tools", "GitHubAgentNode"); // Loop back after tool execution

        this.agentGraph = githubAgentGraph.compile();
        console.log("[GitHubAgent] Initialized successfully");
    }

    /**
     * @param state Agent state
     * @returns Agent node implementation
     */
    protected async agentNode(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const messagesToSend = [
            new SystemMessage(this.implementationMetadata.systemInstruction),
            ...messages
        ]

        try {
            console.log("[GitHubAgent] Invoking LLM with", messages.length, "messages");
            const response = await this.agentLLM!.invoke(messagesToSend);

            // Debug: log what we got back
            const aiResponse = response as AIMessage;
            console.log("[GitHubAgent] Response received:", {
                hasContent: !!aiResponse.content,
                contentLength: typeof aiResponse.content === 'string' ? aiResponse.content.length : 0,
                hasToolCalls: !!(aiResponse.tool_calls && aiResponse.tool_calls.length > 0),
                toolCallsCount: aiResponse.tool_calls?.length || 0
            });

            // If response is empty, return a fallback message
            if (!aiResponse.content && (!aiResponse.tool_calls || aiResponse.tool_calls.length === 0)) {
                console.warn("[GitHubAgent] Empty response from LLM, returning fallback");
                return {
                    messages: [new AIMessage("I apologize, but I couldn't process that request. Please try again or rephrase your question.")]
                }
            }

            return {
                messages: [response]
            }
        } catch (error) {
            console.error("[GitHubAgent] Error in agentNode:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return {
                messages: [new AIMessage(`Error: ${errorMessage}`)]
            }
        }
    }

    /**
     * This method is used to route the agent to the correct tool or end.
     * @param state Agent state
     * @returns Agent route
     */
    private GitHubAgentRoute(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        // If no tool calls, we're done
        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
            return END;
        }

        // Route to tools node
        return "tools";
    }

    /**
     * @param inputMessages Input messages
     * @returns Response
     */
    public async run(inputMessages: AgentChatMessage[]): Promise<Response> {
        const history = inputMessages.map((message) => {
            return message.role == AgentUserRole
                ? new HumanMessage(message.content)
                : new AIMessage(message.content);
        });

        const eventStream = this.agentGraph!.streamEvents(
            { messages: history },
            { version: "v2" }
        );

        // Capture metadata before callback (callback has different 'this' context)
        const agentName = this.userMetadata.name;
        const agentId = this.userMetadata.id;

        const encoder = new TextEncoder();
        const responseStream = new ReadableStream({
            async start(controller) {
                const enqueueJson = (data: object) => {
                    const json = JSON.stringify(data) + "\n";
                    const chunk = encoder.encode(json);
                    controller.enqueue(chunk);
                };

                try {
                    enqueueJson({
                        type: AGENT_STARTED,
                        payload: {
                            name: agentName,
                            content: JSON.stringify(inputMessages),
                            id: agentId
                        }
                    });

                    for await (const event of eventStream) {
                        // Tool execution started
                        if (event.event === TOOL_STARTED_EVENT && event.name === "tools") {
                            // Extract actual tool name from input messages
                            let toolName = "github_tool";
                            const inputMsgs = event.data.input?.messages;
                            if (inputMsgs && inputMsgs.length > 0) {
                                const lastMsg = inputMsgs[inputMsgs.length - 1];
                                if (lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
                                    toolName = lastMsg.tool_calls[0].name;
                                }
                            }
                            console.log("[GitHubAgent] Tool name:", toolName);

                            enqueueJson({
                                type: TOOL_STARTED,
                                payload: {
                                    name: toolName,
                                    content: JSON.stringify(event.data.input),
                                    id: event.run_id
                                }
                            });
                        }
                        // Tool execution ended
                        else if (event.event === TOOL_ENDED_EVENT && event.name === "tools") {
                            // Extract tool name from output
                            let toolName = "github_tool";
                            let output = event.data.output;
                            if (output && output.messages && output.messages.length > 0) {
                                const toolMsg = output.messages[output.messages.length - 1];
                                if (toolMsg.name) {
                                    toolName = toolMsg.name;
                                }
                                output = toolMsg.content;
                            }
                            console.log("[GitHubAgent] Tool name:", toolName);

                            enqueueJson({
                                type: TOOL_ENDED,
                                payload: {
                                    name: toolName,
                                    content: JSON.stringify(output),
                                    id: event.run_id
                                }
                            });
                        }
                        // LLM streaming
                        else if (event.event === ON_CHAT_MODEL_STREAM_EVENT) {
                            enqueueJson({
                                type: AGENT_STREAM,
                                payload: {
                                    name: event.name,
                                    content: event.data.chunk,
                                    id: event.run_id
                                }
                            });
                        }
                    }
                }
                catch (error) {
                    console.error("[GitHubAgent] CRITICAL ERROR inside stream loop:", error);
                    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred inside the stream.";
                    enqueueJson({
                        type: AGENT_ERROR,
                        payload: {
                            name: agentName,
                            content: errorMessage,
                            id: agentId
                        }
                    });
                }
                finally {
                    enqueueJson({
                        type: AGENT_ENDED,
                        payload: {
                            name: agentName,
                            content: "",
                            id: agentId
                        }
                    });
                    controller.close();
                }
            }
        });

        return new Response(responseStream, {
            headers: {
                "Content-Type": "application/json",
                "charset": "utf-8"
            }
        });
    }

}

export const githubAgent = new GitHubAgent(GitHubAgentConfig);
