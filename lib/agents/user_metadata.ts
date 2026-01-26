import { AgentUserMetadata } from "../types";
import { MainAgentConfig } from "./mainAgent/config";
import { GitHubAgentConfig } from "./githubAgent/config";
import { CodebaseAgentConfig } from "./codebaseAgent/config";
import { FrontendAgentConfig } from "./frontendAgent/config";
import { HuggingFaceAgentConfig } from "./huggingFaceAgent/config";
import { GoogleWorkspaceAgentConfig } from "./googleWorkspaceAgent/config";
import { TtsAgentConfig } from "./ttsAgent/config";
import { SearchAgentConfig } from "./searchAgent/config";
import { CodingAgentConfig } from "./codingAgent/config";
import { DataAnalystAgentConfig } from "./dataAnalystAgent/config";
import { VisionAgentConfig } from "./visionAgent/config";

/**
 * Static list of agent metadata used by the UI.
 * This file only imports configs and metadata types, making it safe for client-side bundling.
 * It avoids importing agent implementations which may contain server-only modules.
 */
export const agentUserMetadataList: AgentUserMetadata[] = [
    MainAgentConfig.user_metadata,
    GitHubAgentConfig.user_metadata,
    CodebaseAgentConfig.user_metadata,
    FrontendAgentConfig.user_metadata,
    HuggingFaceAgentConfig.user_metadata,
    GoogleWorkspaceAgentConfig.user_metadata,
    TtsAgentConfig.user_metadata,
    SearchAgentConfig.user_metadata,
    CodingAgentConfig.user_metadata,
    DataAnalystAgentConfig.user_metadata,
    VisionAgentConfig.user_metadata,
];
