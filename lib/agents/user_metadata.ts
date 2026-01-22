import { AgentUserMetadata } from "../types";
import { MainAgentConfig } from "./mainAgent/config";
import { GitHubAgentConfig } from "./githubAgent/config";
import { WebAgentConfig } from "./webAgent/config";
import { CodebaseAgentConfig } from "./codebaseAgent/config";
import { FrontendAgentConfig } from "./frontendAgent/config";
import { HuggingFaceAgentConfig } from "./huggingFaceAgent/config";
import { GoogleWorkspaceAgentConfig } from "./googleWorkspaceAgent/config";
import { TtsAgentConfig } from "./ttsAgent/config";

/**
 * Static list of agent metadata used by the UI.
 * This file only imports configs and metadata types, making it safe for client-side bundling.
 * It avoids importing agent implementations which may contain server-only modules.
 */
export const agentUserMetadataList: AgentUserMetadata[] = [
    MainAgentConfig.user_metadata,
    GitHubAgentConfig.user_metadata,
    WebAgentConfig.user_metadata,
    CodebaseAgentConfig.user_metadata,
    FrontendAgentConfig.user_metadata,
    HuggingFaceAgentConfig.user_metadata,
    GoogleWorkspaceAgentConfig.user_metadata,
    TtsAgentConfig.user_metadata,
];
