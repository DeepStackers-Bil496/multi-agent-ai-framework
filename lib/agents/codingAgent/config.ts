import { FiCode } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import type { AgentUserMetadata, LLMImplMetadata } from "../../types";
import type { AgentConfig } from "../agentConfig";
import { codingAgentSystemPrompt } from "./prompt";

const codingAgentUserMetadata: AgentUserMetadata = {
  id: "coding-agent",
  name: "Coding Agent",
  short_description:
    "Full-featured coding assistant for repos, files, commands, and git.",
  long_description:
    "A powerful coding assistant that connects to your GitHub repositories. Browse files, run commands, create branches, write code, run tests, and open pull requests — all from the chat.",
  icon: FiCode,
  suggestedActions: [
    "Write a CLAUDE.md for this project",
    "Explain this codebase architecture",
    "Review recent changes and suggest improvements",
    "Run the test suite and fix failures",
    "Find and fix bugs in the codebase",
  ],
};

const codingAgentImplementationMetadata: LLMImplMetadata = {
  type: API_MODEL_TYPE,
  provider: "google",
  modelID: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
  systemInstruction: codingAgentSystemPrompt,
};

export const CodingAgentConfig: AgentConfig<LLMImplMetadata> = {
  user_metadata: codingAgentUserMetadata,
  implementation_metadata: codingAgentImplementationMetadata,
};
