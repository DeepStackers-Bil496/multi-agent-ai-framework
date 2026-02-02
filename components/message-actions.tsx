import equal from "fast-deep-equal";
import { memo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useCopyToClipboard } from "usehooks-ts";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { stripUIActionTags } from "@/hooks/use-ui-preferences";
import { Action, Actions } from "./elements/actions";
import {
  CopyIcon,
  PencilEditIcon,
  SpeakerIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from "./icons";

type SupportedSpeechBaseLang = "tr" | "en" | "fr" | "es" | "pt" | "it" | "de" | "nl";

function guessBaseLangFromChars(text: string): SupportedSpeechBaseLang | null {
  const lower = text.toLowerCase();

  // Strong signals
  if (/[ğüşöçıİı]/i.test(text)) return "tr";
  if (/[¿¡ñ]/.test(lower)) return "es";
  if (/[ßä]/.test(lower)) return "de";
  if (/[ãõ]/.test(lower)) return "pt";
  if (/[œ]/.test(lower)) return "fr";

  return null;
}

function tokenizeForLangDetect(text: string): string[] {
  return text
    .toLowerCase()
    .slice(0, 600)
    .split(/[^a-zA-ZÀ-ÿİıĞğÜüŞşÖöÇçÑñ]+/u)
    .filter(Boolean);
}

function detectBaseLang(text: string): SupportedSpeechBaseLang {
  const charGuess = guessBaseLangFromChars(text);
  if (charGuess) return charGuess;

  const tokens = tokenizeForLangDetect(text);
  if (tokens.length === 0) return "en";

  const stopwords: Record<SupportedSpeechBaseLang, string[]> = {
    tr: ["ve", "bir", "bu", "şu", "için", "ile", "ama", "değil", "çok", "daha", "ben", "sen", "biz", "siz", "ne"],
    en: ["the", "and", "is", "are", "to", "of", "in", "for", "with", "that", "this", "you", "it", "not"],
    fr: ["le", "la", "les", "et", "est", "des", "une", "dans", "pour", "avec", "que", "pas", "vous", "ce"],
    es: ["el", "la", "los", "las", "y", "que", "en", "una", "para", "con", "por", "no", "esto", "como"],
    pt: ["o", "a", "os", "as", "e", "que", "em", "uma", "para", "com", "por", "não", "isso", "como"],
    it: ["il", "lo", "la", "e", "che", "in", "una", "per", "con", "non", "questo", "come", "anche"],
    de: ["der", "die", "das", "und", "ist", "in", "ein", "für", "mit", "nicht", "dass", "sie", "ich"],
    nl: ["de", "het", "een", "en", "is", "in", "voor", "met", "niet", "dat", "je", "ik", "zijn"],
  };

  const scores: Record<SupportedSpeechBaseLang, number> = {
    tr: 0,
    en: 0,
    fr: 0,
    es: 0,
    pt: 0,
    it: 0,
    de: 0,
    nl: 0,
  };

  for (const [lang, words] of Object.entries(stopwords) as Array<
    [SupportedSpeechBaseLang, string[]]
  >) {
    const set = new Set(words);
    for (const token of tokens) {
      if (set.has(token)) scores[lang] += 1;
    }
  }

  // Soft character bonuses (helps FR/IT/ES/PT differentiation)
  if (/[ç]/.test(text)) scores.fr += 0.5;
  if (/[éèêàùûîï]/i.test(text)) scores.fr += 0.5;
  if (/[áíóú]/i.test(text)) scores.es += 0.5;
  if (/[àèéìòù]/i.test(text)) scores.it += 0.5;
  if (/[ãõç]/i.test(text)) scores.pt += 0.5;
  if (/[äöü]/i.test(text)) scores.de += 0.5;

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] as
    | SupportedSpeechBaseLang
    | undefined;

  if (best && scores[best] > 0) return best;

  const browserBase =
    typeof navigator !== "undefined" ? navigator.language?.slice(0, 2) : "";
  if (
    browserBase === "tr" ||
    browserBase === "en" ||
    browserBase === "fr" ||
    browserBase === "es" ||
    browserBase === "pt" ||
    browserBase === "it" ||
    browserBase === "de" ||
    browserBase === "nl"
  ) {
    return browserBase;
  }

  return "en";
}

function mapBaseToBCP47(base: SupportedSpeechBaseLang): string {
  switch (base) {
    case "tr":
      return "tr-TR";
    case "en":
      return "en-US";
    case "fr":
      return "fr-FR";
    case "es":
      return "es-ES";
    case "pt":
      return "pt-PT";
    case "it":
      return "it-IT";
    case "de":
      return "de-DE";
    case "nl":
      return "nl-NL";
    default:
      return "en-US";
  }
}

async function getVoicesWithRetry(timeoutMs = 500): Promise<SpeechSynthesisVoice[]> {
  const initial = window.speechSynthesis.getVoices();
  if (initial.length > 0) return initial;

  return await new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(window.speechSynthesis.getVoices());
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timer);
      window.speechSynthesis.onvoiceschanged = null;
    };

    window.speechSynthesis.onvoiceschanged = () => {
      cleanup();
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

function pickVoiceForLang(voices: SpeechSynthesisVoice[], targetLang: string) {
  const normalizedTarget = targetLang.toLowerCase();
  const base = normalizedTarget.split("-")[0];

  return (
    voices.find((voice) => voice.lang.toLowerCase() === normalizedTarget) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(`${base}-`)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(base))
  );
}

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
  setMode,
  selectedModelId,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMode?: (mode: "view" | "edit") => void;
  selectedModelId?: string;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (isLoading) {
    return null;
  }

  const textFromParts = message.parts
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

  const handleCopy = async () => {
    if (!textFromParts) {
      toast.error("There's no text to copy!");
      return;
    }

    await copyToClipboard(textFromParts);
    toast.success("Copied to clipboard!");
  };

  const handleSpeak = async () => {
    if (isSpeaking) {
      return;
    }

    const cleanText = stripUIActionTags(textFromParts || "").trim();
    if (!cleanText) {
      toast.error("There's no text to speak!");
      return;
    }

    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }

    try {
      setIsSpeaking(true);
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const baseLang = detectBaseLang(cleanText);
      const targetLang = mapBaseToBCP47(baseLang);
      utterance.lang = targetLang;

      const voices = await getVoicesWithRetry();
      const voice = pickVoiceForLang(voices, targetLang);
      if (voice) utterance.voice = voice;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        toast.error("Unable to speak this message.");
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
      toast.error("Unable to speak this message.");
    }
  };

  // User messages get edit (on hover) and copy actions
  if (message.role === "user") {
    return (
      <Actions className="-mr-0.5 justify-end">
        <div className="relative">
          {setMode && (
            <Action
              className="-left-10 absolute top-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/message:opacity-100"
              data-testid="message-edit-button"
              onClick={() => setMode("edit")}
              tooltip="Edit"
            >
              <PencilEditIcon />
            </Action>
          )}
          <Action onClick={handleCopy} tooltip="Copy">
            <CopyIcon />
          </Action>
        </div>
      </Actions>
    );
  }

  return (
    <Actions className="-ml-0.5">
      {message.role === "assistant" && selectedModelId === "main-agent" && (
        <Action
          disabled={!textFromParts || isSpeaking}
          onClick={handleSpeak}
          tooltip="Speak"
        >
          <SpeakerIcon />
        </Action>
      )}
      <Action onClick={handleCopy} tooltip="Copy">
        <CopyIcon />
      </Action>

      <Action
        data-testid="message-upvote"
        disabled={vote?.isUpvoted}
        onClick={() => {
          const upvote = fetch("/api/vote", {
            method: "PATCH",
            body: JSON.stringify({
              chatId,
              messageId: message.id,
              type: "up",
            }),
          });

          toast.promise(upvote, {
            loading: "Upvoting Response...",
            success: () => {
              mutate<Vote[]>(
                `/api/vote?chatId=${chatId}`,
                (currentVotes) => {
                  if (!currentVotes) {
                    return [];
                  }

                  const votesWithoutCurrent = currentVotes.filter(
                    (currentVote) => currentVote.messageId !== message.id
                  );

                  return [
                    ...votesWithoutCurrent,
                    {
                      chatId,
                      messageId: message.id,
                      isUpvoted: true,
                    },
                  ];
                },
                { revalidate: false }
              );

              return "Upvoted Response!";
            },
            error: "Failed to upvote response.",
          });
        }}
        tooltip="Upvote Response"
      >
        <ThumbUpIcon />
      </Action>

      <Action
        data-testid="message-downvote"
        disabled={vote && !vote.isUpvoted}
        onClick={() => {
          const downvote = fetch("/api/vote", {
            method: "PATCH",
            body: JSON.stringify({
              chatId,
              messageId: message.id,
              type: "down",
            }),
          });

          toast.promise(downvote, {
            loading: "Downvoting Response...",
            success: () => {
              mutate<Vote[]>(
                `/api/vote?chatId=${chatId}`,
                (currentVotes) => {
                  if (!currentVotes) {
                    return [];
                  }

                  const votesWithoutCurrent = currentVotes.filter(
                    (currentVote) => currentVote.messageId !== message.id
                  );

                  return [
                    ...votesWithoutCurrent,
                    {
                      chatId,
                      messageId: message.id,
                      isUpvoted: false,
                    },
                  ];
                },
                { revalidate: false }
              );

              return "Downvoted Response!";
            },
            error: "Failed to downvote response.",
          });
        }}
        tooltip="Downvote Response"
      >
        <ThumbDownIcon />
      </Action>
    </Actions>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }

    return true;
  }
);
