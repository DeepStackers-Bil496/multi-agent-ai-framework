"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage, AgentStreamEvent } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { toast } from "./toast";
import type { VisibilityType } from "./visibility-selector";
import { AGENT_STREAM, AGENT_STARTED, AGENT_ENDED, AGENT_ERROR, TOOL_STARTED, TOOL_ENDED } from "@/lib/constants";
import type { ExecutionStep } from "@/lib/types";


export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialLastContext,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  // ============================================================
  // ORIGINAL VERCEL AI SDK USECHAT HOOK - COMMENTED OUT
  // Uncomment below to restore original useChat behavior
  // ============================================================
  // const {
  //   messages,
  //   setMessages,
  //   sendMessage,
  //   status,
  //   stop,
  //   regenerate,
  //   resumeStream,
  // } = useChat<ChatMessage>({
  //   id,
  //   messages: initialMessages,
  //   experimental_throttle: 100,
  //   generateId: generateUUID,
  //   transport: new DefaultChatTransport({
  //     api: "/api/chat",
  //     fetch: fetchWithErrorHandlers,
  //     prepareSendMessagesRequest(request) {
  //       return {
  //         body: {
  //           id: request.id,
  //           message: request.messages.at(-1),
  //           selectedChatModel: currentModelIdRef.current,
  //           selectedVisibilityType: visibilityType,
  //           ...request.body,
  //         },
  //       };
  //     },
  //   }),
  //   onData: (dataPart) => {
  //     setDataStream((ds) => (ds ? [...ds, dataPart] : []));
  //     if (dataPart.type === "data-usage") {
  //       setUsage(dataPart.data);
  //     }
  //   },
  //   onFinish: () => {
  //     mutate(unstable_serialize(getChatHistoryPaginationKey));
  //   },
  //   onError: (error) => {
  //     if (error instanceof ChatSDKError) {
  //       // Check if it's a credit card error
  //       if (
  //         error.message?.includes("AI Gateway requires a valid credit card")
  //       ) {
  //         setShowCreditCardAlert(true);
  //       } else {
  //         toast({
  //           type: "error",
  //           description: error.message,
  //         });
  //       }
  //     }
  //   },
  // });
  // ============================================================
  // END OF ORIGINAL VERCEL AI SDK USECHAT HOOK
  // ============================================================

  // ============================================================
  // MAIN AGENT CUSTOM STREAM HANDLING - NEW CODE
  // ============================================================
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [status, setStatus] = useState<"ready" | "streaming" | "error">("ready");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Extract text content from a stream event payload
  // Handles various LangChain AIMessageChunk formats
  const extractTextContent = (content: AgentStreamEvent["payload"]["content"]): string => {
    // Direct string
    if (typeof content === "string") {
      return content;
    }

    if (content && typeof content === "object") {
      const anyContent = content as Record<string, unknown>;

      // LangChain AIMessageChunk format: { kwargs: { content: "..." } }
      if (anyContent.kwargs && typeof anyContent.kwargs === "object") {
        const kwargs = anyContent.kwargs as Record<string, unknown>;
        if (typeof kwargs.content === "string") {
          return kwargs.content;
        }
      }

      // Alternative: might have lc_kwargs structure
      if (anyContent.lc_kwargs && typeof anyContent.lc_kwargs === "object") {
        const lcKwargs = anyContent.lc_kwargs as Record<string, unknown>;
        if (typeof lcKwargs.content === "string") {
          return lcKwargs.content;
        }
      }

      // Direct content property
      if ('content' in anyContent && typeof anyContent.content === "string") {
        return anyContent.content;
      }
    }

    // Debug: log unhandled format
    console.log("[extractTextContent] Unhandled content format:", JSON.stringify(content));
    return "";
  };


  // Custom sendMessage function for MainAgent
  const sendMessage = useCallback(async (userMessage?: Partial<ChatMessage>) => {
    if (!userMessage || !userMessage.parts) {
      console.warn("sendMessage called without message or parts");
      return;
    }
    // Create user message
    const newUserMessage: ChatMessage = {
      id: generateUUID(),
      role: "user" as const,
      parts: userMessage.parts || [],
      metadata: { createdAt: new Date().toISOString() },
    };

    // Add user message to state
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setStatus("streaming");

    // Create placeholder assistant message
    const assistantMessageId = generateUUID();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant" as const,
      parts: [{ type: "text", text: "" }],
      metadata: { createdAt: new Date().toISOString() },
    };
    setMessages([...updatedMessages, assistantMessage]);

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          message: newUserMessage,
          selectedChatModel: currentModelIdRef.current,
          selectedVisibilityType: visibilityType,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      const activeAgentStack: string[] = [];
      const nodeMap = new Map<string, ExecutionStep>();
      const rootSteps: ExecutionStep[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          try {
            const data: AgentStreamEvent = JSON.parse(line);

            if (data.type === AGENT_STARTED) {
              const step: ExecutionStep = {
                id: data.payload.id,
                type: "agent",
                name: data.payload.name,
                status: "running",
                startTime: Date.now(),
                children: [],
                input: data.payload.content ? JSON.parse(data.payload.content as string) : undefined
              };

              nodeMap.set(step.id, step);

              if (activeAgentStack.length === 0) {
                rootSteps.push(step);
              } else {
                const parentId = activeAgentStack[activeAgentStack.length - 1];
                const parent = nodeMap.get(parentId);
                if (parent) {
                  parent.children.push(step);
                }
              }

              activeAgentStack.push(step.id);
            }
            else if (data.type === AGENT_ENDED) {
              const step = nodeMap.get(data.payload.id);
              if (step) {
                step.status = "completed";
                step.endTime = Date.now();
                try {
                  step.output = data.payload.content ? JSON.parse(data.payload.content as string) : undefined;
                } catch {
                  step.output = data.payload.content;
                }
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
                input: data.payload.content ? JSON.parse(data.payload.content as string) : undefined
              };

              nodeMap.set(step.id, step);

              if (activeAgentStack.length > 0) {
                const parentId = activeAgentStack[activeAgentStack.length - 1];
                const parent = nodeMap.get(parentId);
                if (parent) {
                  parent.children.push(step);
                }
              } else {
                rootSteps.push(step);
              }
            }
            else if (data.type === TOOL_ENDED) {
              const step = nodeMap.get(data.payload.id);
              if (step) {
                step.status = "completed";
                step.endTime = Date.now();
                try {
                  step.output = data.payload.content ? JSON.parse(data.payload.content as string) : undefined;
                } catch {
                  step.output = data.payload.content;
                }
              }
            }
            else if (data.type === AGENT_STREAM) {
              const textChunk = extractTextContent(data.payload.content);
              accumulatedText += textChunk;
            } else if (data.type === AGENT_ERROR) {
              const errorContent = typeof data.payload.content === "string"
                ? data.payload.content
                : "An error occurred";

              // Mark current active node as error
              if (activeAgentStack.length > 0) {
                const step = nodeMap.get(activeAgentStack[activeAgentStack.length - 1]);
                if (step) {
                  step.status = "error";
                  step.endTime = Date.now();
                  step.output = errorContent;
                }
              }

              toast({ type: "error", description: errorContent });
            }

            // Update messages with both text and execution flow
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? {
                    ...msg,
                    parts: [
                      { type: "text" as const, text: accumulatedText },
                      { type: "data-agent-execution" as const, data: [...rootSteps] }
                    ] as any
                  }
                  : msg
              )
            );
          } catch (e) {
            console.error("Error parsing stream line:", e, line);
          }
        }
      }

      setStatus("ready");
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setStatus("ready");
        return;
      }
      console.error("Stream error:", error);
      setStatus("error");
      toast({ type: "error", description: "Failed to get response from agent" });
    }
  }, [messages, id, visibilityType, mutate]);

  // Stop function
  const stop = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus("ready");
  }, []);

  // Placeholder regenerate function (simplified)
  const regenerate = useCallback(async () => {
    // Remove last assistant message and resend
    const lastUserMessageIndex = messages.findLastIndex((m) => m.role === "user");
    if (lastUserMessageIndex >= 0) {
      const lastUserMessage = messages[lastUserMessageIndex];
      setMessages(messages.slice(0, lastUserMessageIndex));
      await sendMessage(lastUserMessage);
    }
  }, [messages, sendMessage]);

  // Placeholder resumeStream (not supported with MainAgent yet)
  const resumeStream = useCallback(async () => {
    console.warn("resumeStream not implemented for MainAgent");
  }, []);
  // ============================================================
  // END OF MAIN AGENT CUSTOM STREAM HANDLING
  // ============================================================

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });


  return (
    <>
      <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
        <ChatHeader
          chatId={id}
          isReadonly={isReadonly}
          selectedVisibilityType={initialVisibilityType}
        />

        <Messages
          chatId={id}
          isArtifactVisible={isArtifactVisible}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={currentModelId}
          setMessages={setMessages}
          status={status}
          votes={votes}
        />

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
          {!isReadonly && (
            <MultimodalInput
              attachments={attachments}
              chatId={id}
              input={input}
              messages={messages}
              onModelChange={setCurrentModelId}
              selectedModelId={currentModelId}
              selectedVisibilityType={visibilityType}
              sendMessage={sendMessage}
              setAttachments={setAttachments}
              setInput={setInput}
              setMessages={setMessages}
              status={status}
              stop={stop}
              usage={usage}
            />
          )}
        </div>
      </div>

      <Artifact
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={currentModelId}
        onModelChange={setCurrentModelId}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
