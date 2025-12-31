
import { AgentImplMetadata, AgentUserMetadata } from "../types";

export interface AgentConfig<T extends AgentImplMetadata = AgentImplMetadata, M extends AgentUserMetadata = AgentUserMetadata> {
    user_metadata: M;
    implementation_metadata: T;
}
