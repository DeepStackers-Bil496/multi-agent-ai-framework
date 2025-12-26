
import { AgentImplementation } from "../types";

export interface AgentMetadata {
    id: string;
    name: string;
    description: string;
    icon?: React.ComponentType<{ className?: string }>;
}

export interface AgentConfig<T extends AgentImplementation = AgentImplementation, M extends AgentMetadata = AgentMetadata> {
    metadata: M;
    implementation: T;
}
