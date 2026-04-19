/**
 * CodebaseAgent Configuration
 * Agent for answering questions about the codebase using RAG
 */

import { AgentConfig } from "../agentConfig";
import { FiCode } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { codebaseAgentSystemPrompt } from "./prompt";

const codebaseAgentUserMetadata: AgentUserMetadata = {
    id: "codebase-agent",
    name: "Codebase Agent",
    short_description: "Ask questions about this project's code",
    long_description: "Uses RAG to retrieve relevant code snippets and answer questions about the implementation. Powered by vector search and semantic understanding.",
    icon: FiCode,
    suggestedActions: [
        "How does authentication work in this project?",
        "Where is the MainAgent's orchestration graph built?",
        "Find everywhere `agentRegistry.register` is called.",
        "Explain the streaming event pipeline from baseAgent.run() to the frontend.",
        "Which files touch the `codebaseEmbedding` table?",
        "Show how a specialized agent binds its tools to the LLM.",
    ],
};

const codebaseAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-2.5-flash",
    systemInstruction: codebaseAgentSystemPrompt,
    apiKey: process.env.GEMINI_API_KEY,
};

export const CodebaseAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: codebaseAgentUserMetadata,
    implementation_metadata: codebaseAgentImplementationMetadata,
};
