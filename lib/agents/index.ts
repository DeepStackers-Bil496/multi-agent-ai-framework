import { mainAgent } from "./mainAgent/mainAgent";
import { agentRegistry } from "./agentRegistry";
import { agentUserMetadataList } from "./user_metadata";

// Export metadata for components that don't need agent instances
export { agentUserMetadataList };

// Build agents list with instances for server-side usage
export const agents = agentUserMetadataList.map(metadata => ({
    ...metadata,
    instance: metadata.id === "main-agent"
        ? mainAgent
        : agentRegistry.getById(metadata.id)?.instance || mainAgent
}));

export function getAgentById(id: string) {
    const agent = agents.find(a => a.id === id);
    return agent || agents[0];
}
