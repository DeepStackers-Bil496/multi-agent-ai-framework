/**
 * Direct API test for DataAnalystAgent via MainAgent delegation
 * Simulates real chat interaction
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createMainAgentTools } from "../../lib/agents/mainAgent/mainAgent";
import { agentRegistry } from "../../lib/agents/agentRegistry";

describe("MainAgent → DataAnalyst Delegation", () => {
  it("MainAgent has delegate_to_data_analyst tool", () => {
    const tools = createMainAgentTools();
    const toolNames = tools.map(t => t.name);
    
    console.log("\n🛠️ Available MainAgent tools:");
    toolNames.forEach(name => console.log(`  - ${name}`));
    
    assert.ok(toolNames.includes("delegate_to_data_analyst"), 
      "MainAgent should have delegate_to_data_analyst tool");
  });

  it("DataAnalyst is registered in agentRegistry", () => {
    const dataAnalyst = agentRegistry.get("data-analyst-agent");
    
    console.log("\n📋 DataAnalyst Registry Info:");
    console.log(`  ID: ${dataAnalyst?.id}`);
    console.log(`  Name: ${dataAnalyst?.name}`);
    console.log(`  Tool Name: ${dataAnalyst?.toolName}`);
    console.log(`  Description: ${dataAnalyst?.toolDescription?.substring(0, 100)}...`);
    
    assert.ok(dataAnalyst, "DataAnalyst should be registered");
    assert.equal(dataAnalyst.toolName, "delegate_to_data_analyst");
  });

  it("delegate_to_data_analyst tool executes successfully", async () => {
    const tools = createMainAgentTools();
    const delegateTool = tools.find(t => t.name === "delegate_to_data_analyst");
    
    assert.ok(delegateTool, "Tool should exist");
    
    const result = await delegateTool.func({
      task: "Generate a histogram of SALES column from uploaded CSV"
    });
    
    console.log("\n🎯 Delegation result:");
    console.log(result);
    
    assert.ok(typeof result === "string", "Should return a string");
    assert.ok(result.includes("Data Analyst"), "Should mention Data Analyst");
  });

  it("DataAnalyst tools are accessible", () => {
    const dataAnalyst = agentRegistry.get("data-analyst-agent");
    assert.ok(dataAnalyst?.instance);
    
    const tools = (dataAnalyst.instance as any).tools;
    console.log("\n🧰 DataAnalyst tools count:", tools?.length || 0);
    
    if (tools && tools.length > 0) {
      console.log("Tool names:");
      tools.forEach((tool: any) => console.log(`  - ${tool.name}`));
    }
    
    assert.ok(tools && tools.length > 0, "DataAnalyst should have tools");
  });

  it("All agent tools are properly typed", () => {
    const allAgents = agentRegistry.getAll();
    
    console.log("\n📦 Registered agents:");
    allAgents.forEach(agent => {
      console.log(`  - ${agent.id}: ${agent.toolName}`);
    });
    
    assert.ok(allAgents.length >= 7, "Should have at least 7 agents registered");
    
    const dataAnalyst = allAgents.find(a => a.id === "data-analyst-agent");
    assert.ok(dataAnalyst, "DataAnalyst should be in registry");
  });
});
