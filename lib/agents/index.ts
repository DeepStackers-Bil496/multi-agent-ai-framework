
import { mainAgent } from "./mainAgent/mainAgent";
import { agentUserMetadataList } from "./user_metadata";

export const agents = agentUserMetadataList.map(m => ({
    ...m,
    instance: mainAgent
}));

export function getAgentById(id: string) {
    const agent = agents.find(a => a.id === id);
    return agent || agents[0];
}
