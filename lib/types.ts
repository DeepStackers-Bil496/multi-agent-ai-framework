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

import {
  MainAgentUserRole,
  MainAgentAssistantRole,
  API_MODEL_TYPE,
  LOCAL_MODEL_TYPE,
  LOCAL_VISION_MODEL_TYPE,
  API_VISION_MODEL_TYPE
} from "./constants";

/**
 * We will be using this types at the main agent's chat messages.
 */
export type MainAgentChatRole = typeof MainAgentUserRole | typeof MainAgentAssistantRole;
export type MainAgentChatMessage = { role: MainAgentChatRole; content: string };


/**
 * We will be using this types at the agent implementations.
 */
export type APILLMImpl = {
  type: typeof API_MODEL_TYPE;
  modelID: string;
  systemInstruction: string;
  apiKey: string;
};

export type LocalLLMImpl = {
  type: typeof LOCAL_MODEL_TYPE;
  modelPath: string;
  contextWindow: number;
  hfSpaceID?: string;
  systemInstruction: string;
};

export type LocalVisionModelImpl = {
  type: typeof LOCAL_VISION_MODEL_TYPE;
  modelID: string;
  systemInstruction: string;
};

export type APIVisionModelImpl = {
  type: typeof API_VISION_MODEL_TYPE;
  modelID: string;
  systemInstruction: string;
};

export type AgentImplementation =
  | APILLMImpl
  | LocalLLMImpl
  | LocalVisionModelImpl
  | APIVisionModelImpl;
