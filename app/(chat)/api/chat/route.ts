import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { unstable_cache as cache } from "next/cache";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import { auth, type UserType } from "@/app/(auth)/auth";
import type { VisibilityType } from "@/components/visibility-selector";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import type { ChatModel } from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment, isTestEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveDocument,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage, AgentChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID, getTextFromMessage } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";
import { getAgentById } from "@/lib/agents";
import { AgentUserRole, AgentAssistantRole, AGENT_STREAM, AGENT_STARTED, AGENT_ENDED, TOOL_STARTED, TOOL_ENDED, AGENT_ERROR } from "@/lib/constants";
import type { ExecutionStep } from "@/lib/types";
import { resolveAgentConfig, resolveAllAgentConfigs, recomputeConfigVersion } from "@/lib/agents/configResolver";
import { LLMImplMetadata } from "@/lib/types";
import {
  createMockAgentResponse,
  getMockArtifactDraft,
} from "@/lib/testing/mock-agent-response";


export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        "TokenLens: catalog fetch failed, using default catalog",
        err
      );
      return; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 } // 24 hours
);

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      assistantMessageId,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      assistantMessageId?: string;
      message: ChatMessage;
      selectedChatModel: ChatModel["id"];
      selectedVisibilityType: VisibilityType;
    } = requestBody as any;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const testMessageCountHeader = request.headers.get("x-test-message-count");
    const testMessageCount =
      isTestEnvironment && testMessageCountHeader !== null
        ? Number.parseInt(testMessageCountHeader, 10)
        : Number.NaN;

    const messageCount = Number.isFinite(testMessageCount)
      ? testMessageCount
      : isTestEnvironment
        ? 0
        : await getMessageCountByUserId({
            id: session.user.id,
            differenceInHours: 24,
          });

    if (Number(messageCount) > Number(entitlementsByUserType[userType].maxMessagesPerDay)) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
      // Only fetch messages if chat already exists
      messagesFromDb = await getMessagesByChatId({ id });
    } else {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
      // New chat - no need to fetch messages, it's empty
    }

    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // ============================================================
    // ORIGINAL VERCEL AI SDK STREAMING CODE - COMMENTED OUT
    // Uncomment below to restore original streamText behavior
    // ============================================================
    // let finalMergedUsage: AppUsage | undefined;

    // const stream = createUIMessageStream({
    //   execute: ({ writer: dataStream }) => {
    //     const result = streamText({
    //       model: myProvider.languageModel(selectedChatModel),
    //       system: systemPrompt({ selectedChatModel, requestHints }),
    //       messages: convertToModelMessages(uiMessages),
    //       stopWhen: stepCountIs(5),
    //       experimental_activeTools:
    //         selectedChatModel === "chat-model-reasoning"
    //           ? []
    //           : [
    //             "getWeather",
    //             "createDocument",
    //             "updateDocument",
    //             "requestSuggestions",
    //           ],
    //       experimental_transform: smoothStream({ chunking: "word" }),
    //       tools: {
    //         getWeather,
    //         createDocument: createDocument({ session, dataStream }),
    //         updateDocument: updateDocument({ session, dataStream }),
    //         requestSuggestions: requestSuggestions({
    //           session,
    //           dataStream,
    //         }),
    //       },
    //       experimental_telemetry: {
    //         isEnabled: isProductionEnvironment,
    //         functionId: "stream-text",
    //       },
    //       onFinish: async ({ usage }) => {
    //         try {
    //           const providers = await getTokenlensCatalog();
    //           const modelId =
    //             myProvider.languageModel(selectedChatModel).modelId;
    //           if (!modelId) {
    //             finalMergedUsage = usage;
    //             dataStream.write({
    //               type: "data-usage",
    //               data: finalMergedUsage,
    //             });
    //             return;
    //           }

    //           if (!providers) {
    //             finalMergedUsage = usage;
    //             dataStream.write({
    //               type: "data-usage",
    //               data: finalMergedUsage,
    //             });
    //             return;
    //           }

    //           const summary = getUsage({ modelId, usage, providers });
    //           finalMergedUsage = { ...usage, ...summary, modelId } as AppUsage;
    //           dataStream.write({ type: "data-usage", data: finalMergedUsage });
    //         } catch (err) {
    //           console.warn("TokenLens enrichment failed", err);
    //           finalMergedUsage = usage;
    //           dataStream.write({ type: "data-usage", data: finalMergedUsage });
    //         }
    //       },
    //     });

    //     result.consumeStream();

    //     dataStream.merge(
    //       result.toUIMessageStream({
    //         sendReasoning: true,
    //       })
    //     );
    //   },
    //   generateId: generateUUID,
    //   onFinish: async ({ messages }) => {
    //     await saveMessages({
    //       messages: messages.map((currentMessage) => ({
    //         id: currentMessage.id,
    //         role: currentMessage.role,
    //         parts: currentMessage.parts,
    //         createdAt: new Date(),
    //         attachments: [],
    //         chatId: id,
    //       })),
    //     });

    //     if (finalMergedUsage) {
    //       try {
    //         await updateChatLastContextById({
    //           chatId: id,
    //           context: finalMergedUsage,
    //         });
    //       } catch (err) {
    //         console.warn("Unable to persist last usage for chat", id, err);
    //       }
    //     }
    //   },
    //   onError: () => {
    //     return "Oops, an error occurred!";
    //   },
    // });

    // const streamContext = getStreamContext();

    // if (streamContext) {
    //   return new Response(
    //     await streamContext.resumableStream(streamId, () =>
    //       stream.pipeThrough(new JsonToSseTransformStream())
    //     )
    //   );
    // }

    // return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    // ============================================================
    // END OF ORIGINAL VERCEL AI SDK STREAMING CODE
    // ============================================================

    // ============================================================
    // AGENT INTEGRATION - NEW CODE
    // ============================================================
    // Convert UI messages to Agent format (including image URLs for multimodal support)
    // Convert UI messages to Agent format (including text/code/pdf content extraction)
    const agentMessages: AgentChatMessage[] = await Promise.all(
      uiMessages.map(async (msg) => {
        // Extract text content from message parts
        const textContent = msg.parts
          ?.filter((part): part is { type: "text"; text: string } => part.type === "text")
          .map((part) => part.text)
          .join("") || "";

        // Extract and process ALL file attachments
        const fileParts = msg.parts?.filter(
          (part): part is { type: "file"; url: string; name: string; mediaType: string } => part.type === "file"
        ) || [];

        const fileAttachmentsPromises = fileParts.map(async (part) => {
          if (part.mediaType?.startsWith("image/")) {
            return `[Image: ${part.url}]`;
          }

          const filename = (part.name || "").toLowerCase();
          const media = (part.mediaType || "").toLowerCase();

          const isTextOrCode = 
            media.includes("text") || 
            media.includes("javascript") || 
            media.includes("typescript") || 
            media.includes("json") ||
            media.includes("python") ||
            filename.endsWith(".py") || 
            filename.endsWith(".java") || 
            filename.endsWith(".ts") || 
            filename.endsWith(".tsx") ||
            filename.endsWith(".md") ||
            filename.endsWith(".txt") ||
            filename.endsWith(".csv");

          const isPdf = media.includes("pdf") || filename.endsWith(".pdf");

          if (isTextOrCode) {
            console.log(`[Dosya Okuma] Metin/Kod indiriliyor... URL: ${part.url}`);
            try {
              const response = await fetch(part.url);
              if (response.ok) {
                const fileContent = await response.text();
                return `\n--- KULLANICININ YÜKLEDİĞİ DOSYA: ${part.name} ---\n\`\`\`\n${fileContent}\n\`\`\`\n--- DOSYA SONU ---\n`;
              }
            } catch (e) {
              console.error(`[Dosya Okuma] FETCH HATASI:`, e);
            }
          } 
          else if (isPdf) {
            console.log(`[PDF Okuma] PDF indiriliyor ve çevriliyor... URL: ${part.url}`);
            try {
              const response = await fetch(part.url);
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                
                // İŞTE ÇÖZÜM BURADA: Sunucuyu kilitlemeyen güvenli çağrı!
                const pdfParse = require("pdf-parse"); 
                const pdfData = await pdfParse(buffer);
                
                console.log(`[PDF Okuma] BAŞARILI! Toplam karakter: ${pdfData.text.length}`);
                return `\n--- KULLANICININ YÜKLEDİĞİ PDF DOSYASI: ${part.name} ---\n\`\`\`\n${pdfData.text}\n\`\`\`\n--- DOSYA SONU ---\n`;
              }
            } catch (e) {
              console.error(`[PDF Okuma] PDF Çeviri Hatası: ${filename}`, e);
            }
          }

          // Okunabilir değilse sadece URL bırak (Ajanın kendi toolları varsa kullanır)
          return `[File: ${part.name} (${part.mediaType}) - URL: ${part.url}]`;
        });

        const resolvedAttachments = await Promise.all(fileAttachmentsPromises);
        const fileAttachments = resolvedAttachments.join("\n");

      // DEBUG: Log file attachments
      if (fileAttachments) {
        console.log('[CHAT] File attachments detected:', fileAttachments);
      }

      // Combine text and file info
      const fullContent = fileAttachments 
        ? `${textContent}\n\n${fileAttachments}`
        : textContent;
      
      // DEBUG: Log final content
      if (msg.role === 'user' && fileAttachments) {
        console.log('[CHAT] User message with files:', fullContent.slice(0, 300));
      }

        return {
          role: msg.role === "user" ? AgentUserRole : AgentAssistantRole,
          content: fullContent,
        };
      })
    );

    // Get the selected agent
    const agent = getAgentById(selectedChatModel);

    let runtimeConfig: Partial<LLMImplMetadata> | undefined;
    let runtimeSecrets: Record<string, string> = {};

    if (!isTestEnvironment) {
      // Resolve user-specific configuration only on the real runtime path.
      const resolvedConfig = await resolveAgentConfig(
        session.user.id,
        selectedChatModel
      );

      runtimeSecrets = resolvedConfig.secrets;

      // Special handling for MainAgent: Load configs for all agents to enable orchestration
      if (selectedChatModel === "main-agent") {
        const allConfigs = await resolveAllAgentConfigs(session.user.id);
        const subAgentConfigs: Record<string, Partial<LLMImplMetadata>> = {};

        for (const [agentId, config] of Object.entries(allConfigs)) {
          // Merge secrets so MainAgent can authenticate sub-agent tools
          runtimeSecrets = { ...runtimeSecrets, ...config.secrets };

          // Store specific LLM config for sub-agents
          if (Object.keys(config.llmConfig).length > 0) {
            subAgentConfigs[agentId] = config.llmConfig;
          }
        }

        // Attach subAgentConfigs to runtimeConfig
        runtimeConfig = {
          ...resolvedConfig.llmConfig,
          subAgentConfigs,
        };
        // Recompute version to include sub-agent configs (ensures cache invalidation when any sub-agent changes)
        runtimeConfig._configVersion = recomputeConfigVersion(runtimeConfig, runtimeSecrets);
      } else {
        runtimeConfig = Object.keys(resolvedConfig.llmConfig).length > 0
          ? resolvedConfig.llmConfig
          : undefined;
      }
    }

    const mockArtifactDraft = isTestEnvironment
      ? getMockArtifactDraft(getTextFromMessage(message))
      : null;

    const persistedArtifactDraft = mockArtifactDraft
      ? {
          ...mockArtifactDraft,
          id: generateUUID(),
        }
      : undefined;

    if (persistedArtifactDraft) {
      await saveDocument({
        id: persistedArtifactDraft.id,
        title: persistedArtifactDraft.title,
        content: persistedArtifactDraft.content,
        kind: persistedArtifactDraft.kind,
        userId: session.user.id,
      });
    }

    const agentResponse = isTestEnvironment
      ? createMockAgentResponse({
          agentId: agent.id,
          agentName: agent.name,
          inputMessages: agentMessages,
          artifactDraft: persistedArtifactDraft,
        })
      : await agent.instance.run(agentMessages, runtimeConfig, runtimeSecrets);

    if (!agentResponse.body) {
      throw new Error("No response body from Agent");
    }

    // Create a passthrough stream that captures content and execution flow for persistence
    const persistedAssistantMessageId = assistantMessageId ?? generateUUID();
    let accumulatedContent = "";
    const activeAgentStack: string[] = [];
    const nodeMap = new Map<string, ExecutionStep>();
    const rootSteps: ExecutionStep[] = [];

    const originalStream = agentResponse.body;
    const reader = originalStream.getReader();
    const decoder = new TextDecoder();

    // Track generated images from tool outputs
    const generatedImages: Array<{
      imageUrl: string;
      prompt: string;
      model: string;
      dimensions: { width: number; height: number };
    }> = [];

    const passthroughStream = new ReadableStream({
      async start(controller) {
        const safeParse = (content: any) => {
          if (!content) return undefined;
          if (typeof content !== "string") return content;
          try {
            return JSON.parse(content);
          } catch {
            return content;
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Pass through to client
            controller.enqueue(value);

            // Also capture content and execution flow for persistence
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(line => line.trim() !== "");

            for (const line of lines) {
              try {
                const data = JSON.parse(line);

                // Track execution flow hierarchy
                if (data.type === AGENT_STARTED) {
                  const step: ExecutionStep = {
                    id: data.payload.id,
                    type: "agent",
                    name: data.payload.name,
                    status: "running",
                    startTime: Date.now(),
                    children: [],
                    input: safeParse(data.payload.content)
                  };
                  nodeMap.set(step.id, step);
                  if (activeAgentStack.length === 0) rootSteps.push(step);
                  else {
                    const parent = nodeMap.get(activeAgentStack[activeAgentStack.length - 1]);
                    if (parent) parent.children.push(step);
                  }
                  activeAgentStack.push(step.id);
                }
                else if (data.type === AGENT_ENDED) {
                  const step = nodeMap.get(data.payload.id);
                  if (step) {
                    step.status = "completed";
                    step.endTime = Date.now();
                    step.output = safeParse(data.payload.content);
                  }
                  activeAgentStack.pop();
                }
                else if (data.type === TOOL_STARTED) {
                  const step: ExecutionStep = {
                    id: data.payload.id,
                    type: "tool",
                    name: data.payload.name,
                    status: "running",
                    startTime: Date.now(),
                    children: [],
                    input: safeParse(data.payload.content)
                  };
                  nodeMap.set(step.id, step);
                  if (activeAgentStack.length > 0) {
                    const parent = nodeMap.get(activeAgentStack[activeAgentStack.length - 1]);
                    if (parent) parent.children.push(step);
                  } else {
                    rootSteps.push(step);
                  }
                }
                else if (data.type === TOOL_ENDED) {
                  const step = nodeMap.get(data.payload.id);
                  if (step) {
                    step.status = "completed";
                    step.endTime = Date.now();
                    step.output = safeParse(data.payload.content);
                  }

                  // Check if this tool output contains a generated image
                  // Note: Backend double-stringifies, so we may need to parse twice
                  try {
                    let toolOutput = typeof data.payload.content === "string"
                      ? JSON.parse(data.payload.content)
                      : data.payload.content;

                    // If still a string after first parse, parse again (double-stringified)
                    if (typeof toolOutput === "string") {
                      try {
                        toolOutput = JSON.parse(toolOutput);
                      } catch {
                        // ignore
                      }
                    }

                    if (toolOutput?.__generatedImage) {
                      generatedImages.push(toolOutput.__generatedImage);
                    }
                  } catch {
                    // ignore
                  }
                }
                else if (data.type === AGENT_ERROR) {
                  if (activeAgentStack.length > 0) {
                    const step = nodeMap.get(activeAgentStack[activeAgentStack.length - 1]);
                    if (step) {
                      step.status = "error";
                      step.endTime = Date.now();
                      step.output = data.payload.content;
                    }
                  }
                }
                else if (data.type === AGENT_STREAM && data.payload?.content) {
                  const content = data.payload.content;
                  if (typeof content === "string") {
                    accumulatedContent += content;
                  } else if (content?.kwargs?.content) {
                    accumulatedContent += content.kwargs.content;
                  } else if (content?.lc_kwargs?.content) {
                    accumulatedContent += content.lc_kwargs.content;
                  } else if (content?.content) {
                    accumulatedContent += content.content;
                  }
                }
              } catch {
                // Not JSON, ignore
              }
            }
          }

          // Save assistant message to database after stream ends
          const parts = [];

          // Add execution flow
          if (rootSteps.length > 0) {
            parts.push({ type: "data-agent-execution", data: rootSteps });
          }

          // Add generated images
          for (const imageData of generatedImages) {
            parts.push({
              type: "data-generated-image",
              data: imageData,
            });
          }

          // Add text content
          if (accumulatedContent.trim()) {
            parts.push({ type: "text", text: accumulatedContent.trim() });
          }

          if (parts.length > 0) {
            await saveMessages({
              messages: [{
                id: persistedAssistantMessageId,
                role: "assistant",
                parts: parts as any,
                createdAt: new Date(),
                attachments: [],
                chatId: id,
              }],
            });
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(passthroughStream, {
      headers: {
        "Content-Type": "application/json",
        "charset": "utf-8",
      },
    });
    // ============================================================
    // END OF AGENT INTEGRATION
    // ============================================================


  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}