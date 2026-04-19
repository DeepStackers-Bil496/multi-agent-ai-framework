import { AgentConfig } from "../agentConfig";
import { FiCode } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import type { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { codingAgentSystemPrompt } from "./prompt";

const codingAgentUserMetadata: AgentUserMetadata = {
  id: "coding-agent",
  name: "Coding Agent",
  short_description: "General-purpose coding assistant for high-quality implementations.",
  long_description:
    "Specialized agent for software engineering tasks across languages with a focus on correct, idiomatic code.",
  icon: FiCode,
  suggestedActions: [
    "Implement an LRU cache with O(1) get and put operations.",
    "Write a function that detects a cycle in a linked list and returns the node where it begins.",
    "Build a thread-safe rate limiter using the token bucket algorithm.",
    "Implement Dijkstra's shortest path algorithm on a weighted graph.",
    "Design a trie that supports insert, search, and prefix queries.",
    "Write a producer-consumer queue with bounded capacity and backpressure.",
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
