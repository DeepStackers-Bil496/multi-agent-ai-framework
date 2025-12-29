
import { AgentUserMetadata } from "../types";
import { MainAgentConfig } from "./mainAgent/config";
import { GitHubAgentConfig } from "./githubAgent/config";
import { CodingAgentConfig } from "./codingAgent/config";
import { WebScraperAgentConfig } from "./webScraperAgent/config";

export const agentUserMetadataList: AgentUserMetadata[] = [
    MainAgentConfig.user_metadata,
    GitHubAgentConfig.user_metadata,
    CodingAgentConfig.user_metadata,
    WebScraperAgentConfig.user_metadata,
];
