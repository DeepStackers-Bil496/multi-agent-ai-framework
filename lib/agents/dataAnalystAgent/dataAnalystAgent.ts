import type { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { DataAnalystAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createDataAnalystAgentTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";

class DataAnalystAgent extends BaseAgent<LLMImplMetadata> {
  constructor(
    dataAnalystAgentConfig: AgentConfig<LLMImplMetadata>,
    agentTools: DynamicStructuredTool[]
  ) {
    super(dataAnalystAgentConfig, agentTools);
  }

  protected createTools(
    runtimeSecrets?: Record<string, string>
  ): DynamicStructuredTool[] {
    return createDataAnalystAgentTools(runtimeSecrets);
  }
}

export const dataAnalystAgent = new DataAnalystAgent(
  DataAnalystAgentConfig,
  createDataAnalystAgentTools()
);

agentRegistry.register({
  id: dataAnalystAgent.id,
  name: dataAnalystAgent.name,
  toolName: "delegate_to_data_analyst",
  toolDescription: `Route data analysis, cleaning, and visualization tasks here.
Use this when the user asks to:
- Clean or transform datasets (CSV, JSON, etc.)
- Perform statistical analysis or find trends
- Generate visualizations (charts, graphs) using Python
- Get insights from numerical data`,
  taskPrefix: "[Data Analyst Task]",
  instance: dataAnalystAgent,
  getCompiledGraph: () => dataAnalystAgent.getCompiledGraph(),
});
