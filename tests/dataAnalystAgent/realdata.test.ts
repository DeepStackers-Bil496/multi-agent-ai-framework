import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDataAnalystAgentTools } from "../../lib/agents/dataAnalystAgent/tools";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Data Analyst Agent - Real CSV Analysis", () => {
  it("reads and analyzes sales_data_sample.csv", async () => {
    const tools = createDataAnalystAgentTools();
    
    // Read CSV file
    const csvPath = path.join(process.cwd(), "sales_data_sample.csv");
    const csvData = fs.readFileSync(csvPath, "utf-8");
    
    console.log(`📁 CSV loaded: ${csvData.split('\n').length} lines`);
    
    // Test analyze_csv_data tool
    const analyzeTool = tools.find(t => t.name === "analyze_csv_data");
    assert.ok(analyzeTool, "analyze_csv_data tool should exist");
    
    const result = await analyzeTool.func({ 
      csvData,
      columns: ["SALES"]
    });
    
    console.log("\n📊 Analysis Result:");
    console.log(result);
    
    assert.ok(result.includes("SALES"), "Should analyze SALES column");
    assert.ok(result.includes("mean") || result.includes("Mean"), "Should include mean statistics");
  });

  it("generates insights from sales data", async () => {
    const tools = createDataAnalystAgentTools();
    
    const csvPath = path.join(process.cwd(), "sales_data_sample.csv");
    const csvData = fs.readFileSync(csvPath, "utf-8");
    
    const insightsTool = tools.find(t => t.name === "generate_insights");
    assert.ok(insightsTool);
    
    const result = await insightsTool.func({
      csvData,
      focusArea: "Find patterns in SALES data"
    });
    
    console.log("\n💡 Insights:");
    console.log(result);
    
    assert.ok(typeof result === "string" && result.length > 0, "Should return insights");
  });

  it("generates histogram visualization code for SALES column", async () => {
    const tools = createDataAnalystAgentTools();
    
    const vizTool = tools.find(t => t.name === "generate_visualization");
    assert.ok(vizTool);
    
    const result = await vizTool.func({
      chartType: "histogram",
      columns: ["SALES"],
      chartTitle: "Sales Distribution",
      datasetName: "df"
    });
    
    console.log("\n📈 Histogram Code:");
    console.log(result.substring(0, 500) + "...");
    
    assert.ok(result.includes("histogram") || result.includes("hist"), "Should generate histogram code");
    assert.ok(result.includes("SALES"), "Should reference SALES column");
    assert.ok(result.includes("import matplotlib"), "Should import matplotlib");
  });

  it("Phase 2: execute_python_code tool shows setup message without API key", async () => {
    const tools = createDataAnalystAgentTools();
    
    const executeTool = tools.find(t => t.name === "execute_python_code");
    assert.ok(executeTool);
    
    const result = await executeTool.func({
      code: "import pandas as pd\nprint('Hello from E2B')",
      description: "Test E2B setup"
    }, { secrets: {} });
    
    console.log("\n🔧 E2B Setup Check:");
    console.log(result);
    
    assert.ok(result.includes("E2B API Key") || result.includes("E2B_API_KEY"), "Should mention API key requirement");
  });

  it("Phase 2: generate_and_execute_chart tool exists", async () => {
    const tools = createDataAnalystAgentTools();
    
    const chartTool = tools.find(t => t.name === "generate_and_execute_chart");
    assert.ok(chartTool, "generate_and_execute_chart should exist");
    
    console.log("\n✅ Chart generation tool found");
    console.log("Description:", chartTool.description.substring(0, 150) + "...");
  });
});
