
export interface AgentConfig {
    id: string;
    name: string;
    description: string;
    icon?: React.ComponentType<{ className?: string }>;
    modelID?: string;
    systemInstruction?: string;
    sampleUsage?: string;
    sampleDialogue?: Array<{ role: "user" | "assistant"; content: string }>;
}
