
import { AgentUserMetadata } from "../types";
import { MainAgentConfig } from "./mainAgent/config";
import { GitHubAgentConfig } from "./githubAgent/config";
import { WebAgentConfig } from "./webAgent/config";

export const agentUserMetadataList: AgentUserMetadata[] = [
    MainAgentConfig.user_metadata,
    GitHubAgentConfig.user_metadata,
    WebAgentConfig.user_metadata,
];
