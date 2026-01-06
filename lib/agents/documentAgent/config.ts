import { AgentConfig } from "../agentConfig";
import { MdOutlineDescription } from "react-icons/md";
import { API_MODEL_TYPE } from "../../constants";
import { AgentUserMetadata, LLMImplMetadata } from "../../types";
import { documentAgentSystemPrompt } from "./prompt";

const documentAgentUserMetadata: AgentUserMetadata = {
    id: "document-agent",
    name: "Document Agent",
    short_description: "Summarize, extract key points, and format documents",
    long_description: "Summarize documents, extract key points, generate reports, search document collections, and convert formats.",
    icon: MdOutlineDescription,
    suggestedActions: [
        "Summarize this meeting transcript in 3 sentences.",
        "Extract key points from this report.",
        "Generate a report with sections for findings and next steps.",
    ],
};

const documentAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-2.5-flash",
    systemInstruction: documentAgentSystemPrompt,
    apiKey: process.env.GEMINI_API_KEY || "",
};

export const DocumentAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: documentAgentUserMetadata,
    implementation_metadata: documentAgentImplementationMetadata,
};
