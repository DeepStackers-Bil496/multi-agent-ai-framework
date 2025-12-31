
import { AgentUserMetadata } from "../types";
import { MainAgentConfig } from "./mainAgent/config";
import { GitHubAgentConfig } from "./githubAgent/config";
import { WebAgentConfig } from "./webAgent/config";
import { EmailAgentConfig } from "./emailAgent/config";

export const agentUserMetadataList: AgentUserMetadata[] = [
    MainAgentConfig.user_metadata,
    GitHubAgentConfig.user_metadata,
    EmailAgentConfig.user_metadata,
    WebAgentConfig.user_metadata,
];
