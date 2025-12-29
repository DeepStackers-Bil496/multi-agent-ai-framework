import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { z } from "zod";
import { AgentUserRole, AGENT_START_EVENT, AGENT_END_EVENT, ON_CHAT_MODEL_STREAM_EVENT, AGENT_STARTED, AGENT_ENDED, AGENT_STREAM, AGENT_ERROR } from "@/lib/constants";
import { AgentChatMessage, APILLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { MainAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { githubAgent } from "../githubAgent/githubAgent";

/**
 * Create the GitHub Agent tool that delegates to the GitHubAgent subgraph
 */
function createGitHubAgentTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "github_agent",
        description: `Delegate GitHub-related tasks to the specialized GitHub Agent. 
Use this for ANY GitHub operations including:
- Viewing commits, branches, tags, files
- Creating/updating issues
- Reading/reviewing pull requests
- Searching repositories or code
- Any other GitHub API operations

The GitHub Agent has access to 20+ specialized GitHub tools and will handle the task autonomously.`,
        schema: z.object({
            task: z.string().describe("The complete task description for the GitHub agent. Be specific about what you need."),
        }),
        func: async ({ task }) => {
            console.log("[MainAgent] Delegating to GitHub Agent:", task);
            try {
                const result = await githubAgent.invoke(task);
                console.log("[MainAgent] GitHub Agent completed");
                return result;
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : "Unknown error";
                console.error("[MainAgent] GitHub Agent error:", errorMsg);
                return `GitHub Agent encountered an error: ${errorMsg}`;
            }
        },
    });
}

class MainAgent extends BaseAgent<APILLMImplMetadata> {

    private readonly mainAgentLLM: Runnable;
    private readonly mainAgentGraph: Runnable;
    private readonly mainAgentTools: DynamicStructuredTool[];

    /**
     * @param mainAgentConfig Main agent configuration
     */
    constructor(mainAgentConfig: AgentConfig<APILLMImplMetadata>) {
        super(mainAgentConfig);

        // Create tools - including sub-agent tools
        this.mainAgentTools = [
            createGitHubAgentTool(),
            // Add more sub-agent tools here as needed:
            // createWebAgentTool(),
            // createCodeAgentTool(),
        ];

        this.mainAgentLLM = new ChatGoogleGenerativeAI({
            model: this.implementationMetadata.modelID,
            apiKey: this.implementationMetadata.apiKey,
        }).bindTools(this.mainAgentTools);

        // Create tool node for executing sub-agent tools
        const toolNode = new ToolNode(this.mainAgentTools);

        const mainAgentGraph = new StateGraph(MessagesAnnotation)
            .addNode("MainAgentNode", this.agentNode.bind(this))
            .addNode("tools", toolNode)
            .addEdge(START, "MainAgentNode")
            .addConditionalEdges("MainAgentNode", this.MainAgentRoute.bind(this))
            .addEdge("tools", "MainAgentNode"); // Loop back after tool execution

        this.mainAgentGraph = mainAgentGraph.compile();
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
            const response = await this.mainAgentLLM.invoke(messagesToSend);
            return {
                messages: [response]
            }
        } catch (error) {
            console.error("[MainAgent] Error in agentNode:", error);
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
    private MainAgentRoute(state: typeof MessagesAnnotation.State) {
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
            return message.role == AgentUserRole ? new HumanMessage(message.content) : new AIMessage(message.content);
        });

        const eventStream = this.mainAgentGraph.streamEvents(
            { messages: history },
            { version: "v2" }
        );

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
                            name: "MainAgent",
                            content: JSON.stringify(inputMessages),
                            id: "MainAgent"
                        }
                    });

                    for await (const event of eventStream) {
                        // Tool execution started (sub-agent called)
                        if (event.event === AGENT_START_EVENT && event.name === "tools") {
                            enqueueJson({
                                type: AGENT_STARTED,
                                payload: {
                                    name: "sub_agent_tool",
                                    content: JSON.stringify(event.data.input),
                                    id: event.run_id
                                }
                            });
                        }
                        // Tool execution ended
                        else if (event.event === AGENT_END_EVENT && event.name === "tools") {
                            let output = event.data.output;
                            if (output && output.messages && output.messages.length > 0) {
                                output = output.messages[output.messages.length - 1].content;
                            }

                            enqueueJson({
                                type: AGENT_ENDED,
                                payload: {
                                    name: "sub_agent_tool",
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
                    console.error("[MainAgent] CRITICAL ERROR inside stream loop:", error);
                    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred inside the stream.";
                    enqueueJson({
                        type: AGENT_ERROR,
                        payload: {
                            name: "MainAgent",
                            content: errorMessage,
                            id: "MainAgent"
                        }
                    });
                }
                finally {
                    enqueueJson({
                        type: AGENT_ENDED,
                        payload: {
                            name: "MainAgent",
                            content: "",
                            id: "MainAgent"
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

export const mainAgent = new MainAgent(MainAgentConfig);