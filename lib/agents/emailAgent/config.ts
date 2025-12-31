import { AgentConfig } from "../agentConfig";
import { MdOutlineEmail } from "react-icons/md";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { emailAgentSystemPrompt } from "./prompt";

const emailAgentUserMetadata: AgentUserMetadata = {
    id: "email-agent",
    name: "Email Agent",
    short_description: "Draft and send emails safely with Gemini",
    long_description: "Compose, validate, and send emails with confirmation using a Gemini-powered agent.",
    icon: MdOutlineEmail,
    suggestedActions: [
        "Draft a polite email to alice@example.com asking for a status update.",
        "Write a friendly follow-up email to my recruiter and wait for confirmation before sending.",
        "Compose a formal email to the vendor and include cc to ops@example.com."
    ],
};

const emailAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-1.5-flash",
    systemInstruction: emailAgentSystemPrompt,
    apiKey: process.env.GEMINI_API_KEY || "",
};

export const EmailAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: emailAgentUserMetadata,
    implementation_metadata: emailAgentImplementationMetadata,
};
