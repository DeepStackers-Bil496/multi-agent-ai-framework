/**
 * Quick Debug Test - First 2 scenarios only
 */

// Load environment FIRST
import { config } from "dotenv";
config({ path: ".env.local" });

import { test } from "node:test";
import assert from "node:assert";
import { AgentChatMessage } from "../../lib/types";
import { TOOL_STARTED, TOOL_ENDED, AGENT_STREAM } from "../../lib/constants";

// Sample CSV data
const SAMPLE_CSV = `ORDERNUMBER,QUANTITYORDERED,PRICEEACH,SALES,ORDERDATE,STATUS,MONTH_ID,YEAR_ID,PRODUCTLINE
10107,30,95.7,2871,2/24/2003,Shipped,2,2003,Motorcycles
10121,34,81.35,2765.9,5/7/2003,Shipped,5,2003,Motorcycles
10134,41,94.74,3884.34,7/1/2003,Shipped,7,2003,Motorcycles`;

// Helper to run agent and collect results
async function runAgent(userMessage: string) {
  const { dataAnalystAgent } = await import("../../lib/agents/dataAnalystAgent/dataAnalystAgent");
  const { AgentUserRole } = await import("../../lib/constants");

  const messages: AgentChatMessage[] = [
    { role: AgentUserRole, content: userMessage }
  ];

  const toolsCalled: string[] = [];
  const toolResults = new Map<string, string>();
  let agentResponse = "";

  const response = await dataAnalystAgent.run(messages);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No reader available");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Debug: Show ALL events
      console.log('[RAW EVENT]:', line);
      
      try {
        const parsed = JSON.parse(line);
        console.log('[PARSED]:', parsed.type, parsed.payload?.name || '');
        
        if (parsed.type === TOOL_STARTED) {
          toolsCalled.push(parsed.payload.name);
        }
        
        if (parsed.type === TOOL_ENDED) {
          toolResults.set(parsed.payload.name, parsed.payload.content);
        }
        
        if (parsed.type === AGENT_STREAM) {
          agentResponse += parsed.payload.content || "";
        }
      } catch (e) {
        console.log('[PARSE ERROR]:', e);
      }
    }
  }

  return { toolsCalled, toolResults, agentResponse };
}

test("Debug Test: Pasted CSV", async () => {
  console.log("\n🔍 Debug Test: See raw stream events\n");
  
  const userMessage = `Analyze this data and show me key statistics:

${SAMPLE_CSV}`;

  const { toolsCalled, toolResults } = await runAgent(userMessage);
  
  console.log("\n✅ Tools called:", toolsCalled);
  console.log("✅ Tool results size:", toolResults.size);
  console.log("");
  
  assert.ok(toolsCalled.length > 0, "Should have called some tools");
});
