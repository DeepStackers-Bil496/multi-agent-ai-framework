
import { AgentUserMetadata } from "../types";
import { MainAgentConfig } from "./mainAgent/config";
import { GitHubAgentConfig } from "./githubAgent/config";

export const agentUserMetadataList: AgentUserMetadata[] = [
    MainAgentConfig.user_metadata,
    GitHubAgentConfig.user_metadata,
];
