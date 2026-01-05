import { agentUserMetadataList } from "@/lib/agents/user_metadata";

export const DEFAULT_CHAT_MODEL: string = "main-agent";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

/**
 * Chat models derived from agent metadata.
 * This ensures the model selector stays in sync with registered agents.
 */
export const chatModels: ChatModel[] = agentUserMetadataList.map((agent) => ({
  id: agent.id,
  name: agent.name,
  description: agent.short_description,
}));

/**
 * Get all agent IDs for schema validation
 */
export const agentIds = agentUserMetadataList.map((agent) => agent.id);
