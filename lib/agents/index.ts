
import { mainAgent } from "./mainAgent/mainAgent";
import { githubAgent } from "./githubAgent/githubAgent";
import { agentUserMetadataList } from "./user_metadata";
import { AgentChatMessage } from "../types";
import { webScraperAgent } from "./webScraperAgent/webScraperAgent";

// Common interface for all runnable agents
interface RunnableAgent {
    run(inputMessages: AgentChatMessage[]): Promise<Response>;
}

// Map agent IDs to their instances
const agentInstances: Record<string, RunnableAgent> = {
    "main-agent": mainAgent,
    "github-agent": githubAgent,
    "webscraper-agent": webScraperAgent,
};

export const agents = agentUserMetadataList.map(m => ({
    ...m,
    instance: agentInstances[m.id] || mainAgent
}));

export function getAgentById(id: string) {
    const agent = agents.find(a => a.id === id);
    return agent || agents[0];
}
