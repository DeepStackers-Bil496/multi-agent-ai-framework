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
        "What agents are available and what do they do?",
        "Explain the MainAgent routing logic",
        "Where is the database schema defined?",
        "How does message streaming work?",
    ],
};

const codebaseAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "ollama",
    modelID: "qwen2.5:14b",
    systemInstruction: codebaseAgentSystemPrompt,
    apiKey: "",
    baseURL: "https://fed650d55208.ngrok-free.app",
};

export const CodebaseAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: codebaseAgentUserMetadata,
    implementation_metadata: codebaseAgentImplementationMetadata,
};
