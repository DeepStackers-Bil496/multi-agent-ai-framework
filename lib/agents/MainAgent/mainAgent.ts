import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Tool, DynamicStructuredTool } from "@langchain/core/tools";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { z } from "zod";
import { ThermometerSunIcon } from "lucide-react";

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

class MainAgent {

    private readonly providerModelID: string;
    private readonly providerModelSystemInstruction: string;
    private readonly mainAgentLLM: Runnable;
    private readonly mainAgentGraph: Runnable;
    private readonly mainAgentStateGraph: StateGraph<typeof MessagesAnnotation>;
    private readonly providerAPIKey: string;

    private readonly mainAgentTools: DynamicStructuredTool[];

    constructor(providerModelID: string, providerModelSystemInstruction: string) {
        this.providerModelID = providerModelID;
        this.providerModelSystemInstruction = providerModelSystemInstruction;
        this.providerAPIKey = process.env.GOOGLE_API_KEY || "";
        this.mainAgentTools = [];
        this.mainAgentLLM = new ChatGoogleGenerativeAI({
            model: this.providerModelID,
            apiKey: this.providerAPIKey,
        }).bindTools(this.mainAgentTools);

        this.mainAgentStateGraph = new StateGraph(MessagesAnnotation)
        this.mainAgentGraph = this.mainAgentStateGraph.compile();
    }

    private async MainAgentNode(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const messagesToSend = [
            new SystemMessage(this.providerModelSystemInstruction),
            ...messages
        ]

        const response = await this.mainAgentLLM.invoke(messagesToSend);
        return {
            messages: [response]
        }
    }

    private MainAgentRoute(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;
        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
            return END;
        }
        const toolName = lastMessage.tool_calls[0].name;
        return toolName;
    }

    public async run(currentMessage: string, messages: ChatMessage[]): Promise<Response> {
        const history = messages.slice(0, -1).map((message) => {
            if (message.role === "user") {
                return new HumanMessage(message.content);
            } else {
                return new AIMessage(message.content);
            }
        });

        const inputMessages = [...history, new HumanMessage(currentMessage)];

        const eventStream = this.mainAgentGraph.streamEvents(
            { messages: inputMessages },
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
                        type: "agent_start",
                        payload: {
                            name: "MainAgent",
                            content: JSON.stringify(inputMessages),
                            id: "MainAgent"
                        }
                    });
                    for await (const event of eventStream) {
                        if (event.event === "on_chain_start" && event.name && event.name.endsWith("_worker")) {
                            enqueueJson({
                                type: "agent_start",
                                payload: {
                                    name: event.name,
                                    content: JSON.stringify(event.data.input),
                                    id: event.run_id
                                }
                            });
                        }
                        else if (event.event === "on_chain_end" && event.name && event.name.endsWith("_worker")) {

                            let output = event.data.output;
                            if (output && output.messages && output.messages.length > 0) {
                                output = output.messages[output.messages.length - 1].content;
                                //output = output.messages[0].content; //or it can be the first message
                            }

                            enqueueJson({
                                type: "agent_end",
                                payload: {
                                    name: event.name,
                                    content: JSON.stringify(output),
                                    id: event.run_id
                                }
                            });
                        }
                        else if (event.event === "on_chat_model_stream") {
                            enqueueJson({
                                type: "chunk",
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
                    console.error("[AGENT API] CRITICAL ERROR inside stream loop:", error);
                    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred inside the stream.";
                    enqueueJson({
                        type: "error",
                        payload: {
                            name: "MainAgent",
                            content: errorMessage,
                            id: "MainAgent"
                        }
                    });
                }
                finally {
                    enqueueJson({
                        type: "agent_end",
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