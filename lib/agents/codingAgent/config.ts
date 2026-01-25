import { AgentConfig } from "../agentConfig";
import { FiCode } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import type { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { codingAgentSystemPrompt } from "./prompt";

const codingAgentUserMetadata: AgentUserMetadata = {
  id: "coding-agent",
  name: "Coding Agent",
  short_description: "Python-first coding assistant for high-quality implementations.",
  long_description:
    "Specialized agent for software engineering tasks with Python-first outputs and strong code quality.",
  icon: FiCode,
  suggestedActions: [
    "Write a clean Python function to parse a CSV and return stats.",
    "Refactor this algorithm to be more efficient.",
    "Generate unit tests for this function.",
  ],
};

const codingAgentImplementationMetadata: LLMImplMetadata = {
  type: API_MODEL_TYPE,
  provider: "ollama",
  modelID: "glm-4.7-flash",
  systemInstruction: codingAgentSystemPrompt,
};

export const CodingAgentConfig: AgentConfig<LLMImplMetadata> = {
  user_metadata: codingAgentUserMetadata,
  implementation_metadata: codingAgentImplementationMetadata,
};
