import { DynamicStructuredTool } from "@langchain/core/tools";

/**
 * CodingAgent tools.
 * Reuse codebase semantic search to ground answers in the local repo when available.
 */
export function createCodingAgentTools(_runtimeSecrets?: Record<string, string>): DynamicStructuredTool[] {
  return [];
}
