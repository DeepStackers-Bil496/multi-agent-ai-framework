import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";
import type { AppUsage } from "./usage";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: AppUsage;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};

/**
 * These are the constants that I defined to use both at frontend and backend.
 */
import {
  AgentUserRole,
  AgentAssistantRole,
  API_MODEL_TYPE,
  AGENT_ENDED,
  AGENT_STARTED,
  AGENT_STREAM,
  AGENT_ERROR,
} from "./constants";

/**
 * We will be using this types at the agent's chat messages.
 */
export type AgentChatRole = typeof AgentUserRole | typeof AgentAssistantRole;
export type AgentChatMessage = { role: AgentChatRole; content: string };


/**
 * We will be using this types at the agent implementations.
 */
/**
 * Supported LLM providers
 */
export type LLMProvider =
  | "google"     // Google Gemini
  | "openai"     // OpenAI (also works with vLLM via baseURL)
  | "groq"       // Groq (fast inference)
  | "ollama"     // Ollama (local)
  | "anthropic"  // Anthropic Claude
  | "mistral";   // Mistral AI

export type LLMImplMetadata = {
  type: typeof API_MODEL_TYPE;
  provider: LLMProvider;  // LLM provider (gemini, openai, groq, etc.)
  modelID: string;
  systemInstruction: string;
  apiKey?: string;        // Optional for local providers like Ollama
  baseURL?: string;       // For vLLM or custom endpoints
};

export type AgentImplMetadata =
  | LLMImplMetadata;


export type AgentUserMetadata = {
  id: string;
  name: string;
  short_description: string;
  long_description?: string;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  suggestedActions?: string[];
}

/**
 * Stream event types from MainAgent
 */
export type AgentStreamEvent = {
  type: typeof AGENT_STARTED | typeof AGENT_ENDED | typeof AGENT_STREAM | typeof AGENT_ERROR;
  payload: {
    name: string;
    content: string | Record<string, unknown>;
    id: string;
  };
};

