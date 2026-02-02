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
  "agent-execution": ExecutionStep[];
  "generated-image": {
    imageUrl: string;
    prompt: string;
    model: string;
    dimensions: {
      width: number;
      height: number;
    };
  };
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
  AGENT_STARTED,
  AGENT_ENDED,
  AGENT_STREAM,
  AGENT_ERROR,
  TOOL_STARTED,
  TOOL_ENDED,
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
  | "google"        // Google Gemini
  | "openai"        // OpenAI (also works with vLLM via baseURL)
  | "groq"          // Groq (fast inference)
  | "ollama"        // Ollama (local self-hosted)
  | "ollama-cloud"  // Ollama Cloud (requires API key)
  | "anthropic"     // Anthropic Claude
  | "mistral"       // Mistral AI
  // Self-hosted servers (OpenAI-compatible)
  | "lmstudio"      // LM Studio (default: http://localhost:1234/v1)
  | "localai"       // LocalAI (default: http://localhost:8080/v1)
  | "llamacpp"      // llama-cpp-python server (default: http://localhost:8000/v1)
  | "textgenwebui"  // text-generation-webui (default: http://localhost:5000/v1)
  | "custom";       // Custom OpenAI-compatible endpoint with chat template

/**
 * Chat template types for custom model integration
 * These define how messages are formatted for different model architectures
 */
export type ChatTemplateType =
  | "auto"      // Let the server handle formatting (default)
  | "chatml"    // OpenAI/ChatML format: <|im_start|>role\ncontent<|im_end|>
  | "llama2"    // Llama 2 format: [INST] <<SYS>> system <</SYS>> user [/INST]
  | "llama3"    // Llama 3 format: <|begin_of_text|><|start_header_id|>role<|end_header_id|>
  | "alpaca"    // Alpaca format: ### Instruction:\n### Response:
  | "vicuna"    // Vicuna format: USER: message ASSISTANT:
  | "mistral"   // Mistral instruct format: [INST] message [/INST]
  | "zephyr"    // Zephyr format: <|system|>\n<|user|>\n<|assistant|>
  | "phi"       // Microsoft Phi format: <|system|>\n<|user|>\n<|assistant|>
  | "gemma"     // Google Gemma format: <start_of_turn>user\n<end_of_turn>
  | "qwen"      // Qwen format: <|im_start|>system\n<|im_end|>
  | "deepseek"  // DeepSeek format
  | "command-r" // Cohere Command-R format
  | "custom";   // User-defined custom template

/**
 * Custom chat template configuration
 * Used when chatTemplate is "custom" to define message formatting
 */
export type CustomChatTemplateConfig = {
  // Beginning of conversation (optional)
  bosToken?: string;
  // End of conversation (optional)
  eosToken?: string;
  // System message format
  systemPrefix: string;
  systemSuffix: string;
  // User message format
  userPrefix: string;
  userSuffix: string;
  // Assistant message format
  assistantPrefix: string;
  assistantSuffix: string;
  // Separator between messages (optional)
  messageSeparator?: string;
}

export type LLMImplMetadata = {
  type: typeof API_MODEL_TYPE;
  provider: LLMProvider;  // LLM provider (gemini, openai, groq, etc.)
  modelID: string;
  systemInstruction: string;
  apiKey?: string;        // Optional for local providers like Ollama
  baseURL?: string;       // For vLLM or custom endpoints
  // Chat template configuration (for custom provider)
  chatTemplate?: ChatTemplateType;           // Template type for message formatting
  customTemplate?: CustomChatTemplateConfig; // Custom template config (when chatTemplate is "custom")
  subAgentConfigs?: Record<string, Partial<LLMImplMetadata>>; // Configurations for sub-agents managed by this agent
  _configVersion?: string; // Auto-computed hash for caching - avoids recreating LLM/tools when config unchanged
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
  type: typeof AGENT_STARTED | typeof AGENT_ENDED | typeof AGENT_STREAM | typeof AGENT_ERROR | typeof TOOL_STARTED | typeof TOOL_ENDED;
  payload: {
    name: string;
    content: string | Record<string, unknown>;
    id: string;
  };
};

/**
 * Execution flow step
 */
export type ExecutionStep = {
  id: string;
  type: "agent" | "tool";
  name: string;
  status: "running" | "completed" | "error";
  startTime: number;
  endTime?: number;
  input?: any;
  output?: any;
  children: ExecutionStep[];
};

