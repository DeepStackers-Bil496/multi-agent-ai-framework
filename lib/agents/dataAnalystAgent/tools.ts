import { DynamicStructuredTool } from "@langchain/core/tools";
import { createCodebaseAgentTools } from "../codebaseAgent/tools";

/**
 * DataAnalystAgent tools.
 * Can be expanded with specialized data manipulation tools in the future.
 */
export function createDataAnalystAgentTools(_runtimeSecrets?: Record<string, string>): DynamicStructuredTool[] {
  return [
    ...createCodebaseAgentTools(),
  ];
}
