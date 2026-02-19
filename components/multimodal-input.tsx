"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { Trigger } from "@radix-ui/react-select";
import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import { Loader2, Mic, Square } from "lucide-react";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { SelectItem } from "@/components/ui/select";
import { agentUserMetadataList } from "@/lib/agents/user_metadata";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { cn, fetcher } from "@/lib/utils";
import { Context } from "./elements/context";
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "./elements/prompt-input";
import {
  ArrowUpIcon,
  ChevronDownIcon,
  CpuIcon,
  PaperclipIcon,
  StopIcon,
} from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import { SuggestedActions } from "./suggested-actions";
import { Button } from "./ui/button";
import type { VisibilityType } from "./visibility-selector";

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
  selectedModelId,
  onModelChange,
  usage,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  usage?: AppUsage;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [adjustHeight]);

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustHeight, localStorageInput, setInput]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);

  const stopActiveRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const releaseAudioResources = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  const blobToBase64 = useCallback((blob: Blob) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Failed to read audio buffer"));
          return;
        }

        const commaIndex = result.indexOf(",");
        if (commaIndex < 0) {
          reject(new Error("Invalid base64 payload"));
          return;
        }

        resolve(result.slice(commaIndex + 1));
      };
      reader.onerror = () => reject(new Error("Failed to convert audio"));
      reader.readAsDataURL(blob);
    });
  }, []);

  const transcribeAudioBlob = useCallback(
    async (blob: Blob) => {
      if (blob.size === 0) {
        toast.error("No audio captured. Please try again.");
        return;
      }

      setIsTranscribingAudio(true);

      try {
        const audioBase64 = await blobToBase64(blob);
        const languageHint =
          typeof navigator !== "undefined" ? navigator.language : undefined;

        const response = await fetch("/api/speech/stt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64,
            mimeType: blob.type || "audio/webm",
            languageHint,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            payload?.cause || payload?.message || "Failed to transcribe audio.";
          throw new Error(message);
        }

        const payload = await response.json();
        const transcript =
          typeof payload?.transcript === "string" ? payload.transcript.trim() : "";

        if (!transcript) {
          toast.error("No speech detected. Please try again.");
          return;
        }

        setInput((current) => {
          const prefix = current.trim().length > 0 ? `${current.trim()} ` : "";
          return `${prefix}${transcript}`;
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to transcribe audio."
        );
      } finally {
        setIsTranscribingAudio(false);
      }
    },
    [blobToBase64, setInput]
  );

  const handleMicrophoneToggle = useCallback(async () => {
    if (selectedModelId !== "main-agent") {
      return;
    }

    if (status !== "ready" || isTranscribingAudio) {
      return;
    }

    if (isRecordingAudio) {
      stopActiveRecording();
      return;
    }

    if (
      typeof window === "undefined" ||
      !navigator?.mediaDevices ||
      typeof MediaRecorder === "undefined"
    ) {
      toast.error("Audio recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecordingAudio(false);
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        audioChunksRef.current = [];
        releaseAudioResources();
        await transcribeAudioBlob(audioBlob);
      };

      recorder.onerror = () => {
        setIsRecordingAudio(false);
        releaseAudioResources();
        toast.error("Audio recording failed. Please try again.");
      };

      recorder.start();
      setIsRecordingAudio(true);
    } catch (error) {
      releaseAudioResources();
      toast.error(
        error instanceof Error
          ? error.message
          : "Microphone access denied or unavailable."
      );
    }
  }, [
    isRecordingAudio,
    isTranscribingAudio,
    releaseAudioResources,
    selectedModelId,
    status,
    stopActiveRecording,
    transcribeAudioBlob,
  ]);

  const submitForm = useCallback(() => {
    window.history.pushState({}, "", `/chat/${chatId}`);

    sendMessage({
      role: "user",
      parts: [
        ...attachments.map((attachment) => ({
          type: "file" as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        {
          type: "text",
          text: input,
        },
      ],
    });

    setAttachments([]);
    setLocalStorageInput("");
    resetHeight();
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    resetHeight,
  ]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (_error) {
      toast.error("Failed to upload file, please try again!");
    }
  }, []);


  const contextProps = useMemo(
    () => ({
      usage,
    }),
    [usage]
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith('image/'),
      );

      if (imageItems.length === 0) return;

      // Prevent default paste behavior for images
      event.preventDefault();

      setUploadQueue((prev) => [...prev, 'Pasted image']);

      try {
        const uploadPromises = imageItems.map(async (item) => {
          const file = item.getAsFile();
          if (!file) return;
          return uploadFile(file);
        });

        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) =>
            attachment !== undefined &&
            attachment.url !== undefined &&
            attachment.contentType !== undefined,
        );

        setAttachments((curr) => [
          ...curr,
          ...(successfullyUploadedAttachments as Attachment[]),
        ]);
      } catch (error) {
        console.error('Error uploading pasted images:', error);
        toast.error('Failed to upload pasted image(s)');
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  // Add paste event listener to textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.addEventListener('paste', handlePaste);
    return () => textarea.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      releaseAudioResources();
    };
  }, [releaseAudioResources]);

  return (
    <div className={cn("relative flex w-full flex-col gap-4", className)}>
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
            sendMessage={sendMessage}
            agentId={selectedModelId}
          />
        )}

      <input
        className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
        accept="image/jpeg,image/png,text/csv,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      />

      <PromptInput
        className="rounded-xl border border-border bg-background p-3 shadow-xs transition-all duration-200 focus-within:border-border hover:border-muted-foreground/50"
        onSubmit={(event) => {
          event.preventDefault();
          if (status !== "ready") {
            toast.error("Please wait for the model to finish its response!");
          } else {
            submitForm();
          }
        }}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className="flex flex-row items-end gap-2 overflow-x-scroll"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                attachment={attachment}
                key={attachment.url}
                onRemove={() => {
                  setAttachments((currentAttachments) =>
                    currentAttachments.filter((a) => a.url !== attachment.url)
                  );
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{
                  url: "",
                  name: filename,
                  contentType: "",
                }}
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}
        <div className="flex flex-row items-start gap-1 sm:gap-2">
          <PromptInputTextarea
            id="chat-input-area"
            autoFocus
            className="grow resize-none border-0! border-none! bg-transparent p-2 text-sm outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden"
            data-testid="multimodal-input"
            disableAutoResize={true}
            maxHeight={200}
            minHeight={44}
            onChange={handleInput}
            placeholder="Send a message..."
            ref={textareaRef}
            rows={1}
            value={input}
          />{" "}
          <Context {...contextProps} />
        </div>
        <PromptInputToolbar className="!border-top-0 border-t-0! p-0 shadow-none dark:border-0 dark:border-transparent!">
          <PromptInputTools className="gap-0 sm:gap-0.5">
            <AttachmentsButton
              fileInputRef={fileInputRef}
              selectedModelId={selectedModelId}
              status={status}
            />
            <SpeechToTextButton
              isRecording={isRecordingAudio}
              isTranscribing={isTranscribingAudio}
              onClick={handleMicrophoneToggle}
              selectedModelId={selectedModelId}
              status={status}
            />
            <ModelSelectorCompact
              onModelChange={onModelChange}
              selectedModelId={selectedModelId}
            />
          </PromptInputTools>

          {status === "submitted" ? (
            <StopButton setMessages={setMessages} stop={stop} />
          ) : (
            <PromptInputSubmit
              className="size-8 rounded-full bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
              disabled={!input.trim() || uploadQueue.length > 0}
              status={status}
              data-testid="send-button"
            >
              <ArrowUpIcon size={14} />
            </PromptInputSubmit>
          )}
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }

    return true;
  }
);

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedModelId,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  selectedModelId: string;
}) {
  const isReasoningModel = selectedModelId === "chat-model-reasoning";

  return (
    <Button
      className="aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent"
      data-testid="attachments-button"
      disabled={status !== "ready" || isReasoningModel}
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      variant="ghost"
    >
      <PaperclipIcon size={14} style={{ width: 14, height: 14 }} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureSpeechToTextButton({
  selectedModelId,
  status,
  isRecording,
  isTranscribing,
  onClick,
}: {
  selectedModelId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  isRecording: boolean;
  isTranscribing: boolean;
  onClick: () => void;
}) {
  if (selectedModelId !== "main-agent") {
    return null;
  }

  const isDisabled = status !== "ready" || isTranscribing;

  return (
    <Button
      className={cn(
        "aspect-square h-8 rounded-lg p-1 transition-colors",
        isRecording
          ? "bg-red-500/15 text-red-600 hover:bg-red-500/20"
          : "hover:bg-accent"
      )}
      data-testid="stt-button"
      disabled={isDisabled}
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      title={
        isTranscribing
          ? "Transcribing..."
          : isRecording
            ? "Stop recording"
            : "Start voice input"
      }
      variant="ghost"
    >
      {isTranscribing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <Square className="h-3.5 w-3.5 fill-current" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}

const SpeechToTextButton = memo(PureSpeechToTextButton);

interface AgentPreference {
  agentId: string;
  enabled: boolean;
}

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [optimisticModelId, setOptimisticModelId] = useState(selectedModelId);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOptimisticModelId(selectedModelId);
  }, [selectedModelId]);

  // Fetch user's agent preferences using SWR (shared cache with agent panel)
  const { data: preferencesData } = useSWR<{ preferences: AgentPreference[] }>(
    "/api/user_dashboard/preferences",
    fetcher
  );

  // Compute disabled agents from preferences
  const disabledAgents = useMemo(() => {
    const disabled = new Set<string>();
    if (preferencesData?.preferences) {
      for (const pref of preferencesData.preferences) {
        if (!pref.enabled) {
          disabled.add(pref.agentId);
        }
      }
    }
    return disabled;
  }, [preferencesData]);

  // Filter agents by user preferences
  const availableAgents = useMemo(() => {
    return agentUserMetadataList.filter((agent) => {
      // MainAgent is always available
      if (agent.id === "main-agent") {
        return true;
      }
      // Filter out disabled agents
      return !disabledAgents.has(agent.id);
    });
  }, [disabledAgents]);

  const selectedModel = availableAgents.find(
    (agentUserMetadata) => agentUserMetadata.id === optimisticModelId
  );

  // If selected model is disabled, fall back to main-agent
  useEffect(() => {
    if (!selectedModel && availableAgents.length > 0) {
      const mainAgent = availableAgents.find((m) => m.id === "main-agent");
      if (mainAgent) {
        setOptimisticModelId(mainAgent.id);
        onModelChange?.(mainAgent.id);
        startTransition(() => {
          saveChatModelAsCookie(mainAgent.id);
        });
      }
    }
  }, [selectedModel, availableAgents, onModelChange]);

  if (!mounted) {
    return (
      <Button variant="ghost" className="h-8 px-2" disabled>
        <CpuIcon size={16} />
        <span className="hidden font-medium text-xs sm:block">Loading...</span>
        <ChevronDownIcon size={16} />
      </Button>
    );
  }

  return (
    <PromptInputModelSelect
      onValueChange={(modelName) => {
        const agentUserMetadata = availableAgents.find((m) => m.name === modelName);
        if (agentUserMetadata) {
          setOptimisticModelId(agentUserMetadata.id);
          onModelChange?.(agentUserMetadata.id);
          startTransition(() => {
            saveChatModelAsCookie(agentUserMetadata.id);
          });
        }
      }}
      value={selectedModel?.name}
    >
      <Trigger asChild>
        <Button variant="ghost" className="h-8 px-2">
          {selectedModel?.icon ? (
            <selectedModel.icon size={16} />
          ) : (
            <CpuIcon size={16} />
          )}
          <span className="hidden font-medium text-xs sm:block">
            {selectedModel?.name ?? "Select Agent"}
          </span>
          <ChevronDownIcon size={16} />
        </Button>
      </Trigger>
      <PromptInputModelSelectContent className="min-w-[260px] p-0">
        <div className="flex flex-col gap-px">
          {availableAgents.map((agentUserMetadata) => (
            <SelectItem key={agentUserMetadata.id} value={agentUserMetadata.name}>
              <div className="flex items-center gap-2">
                {agentUserMetadata.icon && <agentUserMetadata.icon size={14} className="text-muted-foreground" />}
                <div className="truncate font-medium text-xs">{agentUserMetadata.name}</div>
              </div>
              <div className="mt-px truncate text-[10px] text-muted-foreground leading-tight">
                {agentUserMetadata.short_description}
              </div>
            </SelectItem>
          ))}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

const ModelSelectorCompact = memo(PureModelSelectorCompact);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <Button
      className="size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
      data-testid="stop-button"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
