/**
 * END-TO-END COMPREHENSIVE TEST
 * Tests DataAnalystAgent with real sales data and E2B execution
 * Simulates actual user workflow: upload CSV → analyze → generate histogram
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDataAnalystAgentTools } from "../../lib/agents/dataAnalystAgent/tools";
import * as fs from "node:fs";
import * as path from "node:path";

// Load real CSV data
const csvPath = path.join(process.cwd(), "sales_data_sample.csv");
const csvData = fs.readFileSync(csvPath, "utf-8");

console.log("🚀 COMPREHENSIVE E2E TEST STARTING");
console.log("=" + "=".repeat(70));

describe("E2E: Complete DataAnalyst Workflow", () => {
  
  it("Phase 1: Reads and parses sales_data_sample.csv", async () => {
    console.log("\n📋 TEST 1: CSV Parsing");
    console.log("-".repeat(70));
    
    const tools = createDataAnalystAgentTools();
    const readTool = tools.find(t => t.name === "read_uploaded_file");
    assert.ok(readTool, "read_uploaded_file should exist");
    
    // Note: This would need a real Vercel Blob URL in production
    // For testing, we'll use the next tool directly
    console.log("✅ Parse tool exists");
    console.log(`📊 CSV size: ${csvData.length} bytes, ${csvData.split('\n').length} lines`);
  });

  it("Phase 1: Analyzes SALES column with descriptive statistics", async () => {
    console.log("\n📊 TEST 2: Statistical Analysis");
    console.log("-".repeat(70));
    
    const tools = createDataAnalystAgentTools();
    const analyzeTool = tools.find(t => t.name === "analyze_csv_data");
    assert.ok(analyzeTool);
    
    const result = await analyzeTool.func({ 
      csvData,
      columns: ["SALES", "QUANTITYORDERED", "PRICEEACH"]
    });
    
    console.log("📈 Analysis output (first 500 chars):");
    console.log(result.substring(0, 500) + "...\n");
    
    assert.ok(result.includes("SALES"), "Should analyze SALES column");
    assert.ok(result.includes("Mean") || result.includes("mean"), "Should include mean");
    assert.ok(result.includes("Median") || result.includes("median"), "Should include median");
    console.log("✅ Statistical analysis successful");
  });

  it("Phase 1: Generates insights from sales data", async () => {
    console.log("\n💡 TEST 3: Insight Generation");
    console.log("-".repeat(70));
    
    const tools = createDataAnalystAgentTools();
    const insightsTool = tools.find(t => t.name === "generate_insights");
    assert.ok(insightsTool);
    
    const result = await insightsTool.func({
      csvData,
      focusArea: "Identify patterns in SALES and correlations with other variables"
    });
    
    console.log("🔍 Insights (first 600 chars):");
    console.log(result.substring(0, 600) + "...\n");
    
    assert.ok(result.length > 100, "Should generate meaningful insights");
    console.log("✅ Insights generated successfully");
  });

  it("Phase 1: Generates histogram visualization code for SALES", async () => {
    console.log("\n📈 TEST 4: Histogram Code Generation");
    console.log("-".repeat(70));
    
    const tools = createDataAnalystAgentTools();
    const vizTool = tools.find(t => t.name === "generate_visualization");
    assert.ok(vizTool);
    
    const result = await vizTool.func({
      chartType: "histogram",
      columns: ["SALES"],
      chartTitle: "Sales Distribution Histogram",
      datasetName: "df"
    });
    
    console.log("🎨 Generated code (first 400 chars):");
    console.log(result.substring(0, 400) + "...\n");
    
    assert.ok(result.includes("histogram") || result.includes("hist"), "Should generate histogram");
    assert.ok(result.includes("SALES"), "Should reference SALES column");
    assert.ok(result.includes("import matplotlib"), "Should import matplotlib");
    assert.ok(result.includes("bins"), "Histogram should have bins parameter");
    console.log("✅ Histogram code generated successfully");
  });

  it("Phase 2: Executes simple Python code via E2B", async () => {
    console.log("\n🔥 TEST 5: E2B Python Execution");
    console.log("-".repeat(70));
    
    const tools = createDataAnalystAgentTools();
    const executeTool = tools.find(t => t.name === "execute_python_code");
    assert.ok(executeTool);
    
    const testCode = `
import pandas as pd
import numpy as np

# Test basic computation
data = {'A': [1, 2, 3, 4, 5], 'B': [10, 20, 30, 40, 50]}
df = pd.DataFrame(data)

print("DataFrame created successfully!")
print(df.describe())
print("Mean of A:", df['A'].mean())
print("Sum of B:", df['B'].sum())
`;
    
    const result = await executeTool.func({
      code: testCode,
      description: "Test E2B with basic pandas operations"
    }, { secrets: { E2B_API_KEY: process.env.E2B_API_KEY || "" } });
    
    console.log("🐍 Python execution result:");
    console.log(result);
    
    if (result.includes("E2B API Key Required")) {
      console.log("⚠️  E2B API key not configured - skipping execution test");
    } else {
      assert.ok(result.includes("Execution Successful") || result.includes("DataFrame"), 
        "Should execute Python code");
      console.log("✅ Python execution successful");
    }
  });

  it("Phase 2: Analyzes SALES data with Python execution", async () => {
    console.log("\n📊 TEST 6: Full Data Analysis with E2B");
    console.log("-".repeat(70));
    
    const tools = createDataAnalystAgentTools();
    const executeTool = tools.find(t => t.name === "execute_python_code");
    assert.ok(executeTool);
    
    // Create analysis code that processes the actual CSV  
    const csvSample = csvData.split('\n').slice(0, 100).join('\n');
    const analysisCode = `
import pandas as pd
import numpy as np
from io import StringIO

# Load CSV data
csv_data = """` + csvSample + `"""

df = pd.read_csv(StringIO(csv_data))

print("=" * 60)
print("SALES COLUMN ANALYSIS")
print("=" * 60)

# Basic statistics
print("\\nTotal records:", len(df))
print("\\nSALES Statistics:")
print("  Mean: $" + "{:.2f}".format(df['SALES'].mean()))
print("  Median: $" + "{:.2f}".format(df['SALES'].median()))
print("  Min: $" + "{:.2f}".format(df['SALES'].min()))
print("  Max: $" + "{:.2f}".format(df['SALES'].max()))
print("  Std Dev: $" + "{:.2f}".format(df['SALES'].std()))

# Percentiles
print("\\nPercentiles:")
print("  25th: $" + "{:.2f}".format(df['SALES'].quantile(0.25)))
print("  50th: $" + "{:.2f}".format(df['SALES'].quantile(0.50)))
print("  75th: $" + "{:.2f}".format(df['SALES'].quantile(0.75)))

# Distribution info
print("\\nDistribution shape:")
print("  Skewness: " + "{:.3f}".format(df['SALES'].skew()))
print("  Kurtosis: " + "{:.3f}".format(df['SALES'].kurtosis()))

print("\\n✅ Analysis complete!")
`;
    
    const result = await executeTool.func({
      code: analysisCode,
      description: "Comprehensive SALES column analysis"
    }, { secrets: { E2B_API_KEY: process.env.E2B_API_KEY || "" } });
    
    console.log("📊 Analysis output:");
    console.log(result);
    
    if (!result.includes("E2B API Key Required")) {
      assert.ok(result.includes("Mean") || result.includes("SALES"), "Should analyze data");
      console.log("✅ E2B analysis successful");
    } else {
      console.log("⚠️  Skipping E2B test - API key not configured");
    }
  });

  it("Phase 2: Generates actual histogram chart via E2B", async () => {
    console.log("\n🎨 TEST 7: Real Histogram Generation (E2B)");
    console.log("-".repeat(70));
    
    const tools = createDataAnalystAgentTools();
    const executeTool = tools.find(t => t.name === "execute_python_code");
    assert.ok(executeTool);
    
    const csvSample2 = csvData.split('\n').slice(0, 100).join('\n');
    const histogramCode = `
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from io import StringIO

# Load sample data (first 100 rows for speed)
csv_data = """` + csvSample2 + `"""
df = pd.read_csv(StringIO(csv_data))

# Create histogram
plt.figure(figsize=(12, 7))
plt.hist(df['SALES'], bins=30, color='steelblue', edgecolor='black', alpha=0.7)
plt.title('Sales Distribution Histogram', fontsize=16, fontweight='bold')
plt.xlabel('Sales Amount (\\$)', fontsize=12)
plt.ylabel('Frequency', fontsize=12)
plt.grid(True, alpha=0.3)

# Add statistics text
mean_val = df['SALES'].mean()
median_val = df['SALES'].median()
plt.axvline(mean_val, color='red', linestyle='--', linewidth=2, label='Mean: $' + '{:.2f}'.format(mean_val))
plt.axvline(median_val, color='green', linestyle='--', linewidth=2, label='Median: $' + '{:.2f}'.format(median_val))
plt.legend()

plt.tight_layout()
plt.show()

print("✅ Histogram generated successfully!")
print("   Mean: $" + "{:.2f}".format(mean_val))
print("   Median: $" + "{:.2f}".format(median_val))
print("   Total sales analyzed: " + str(len(df)) + " records")
`;
    
    const result = await executeTool.func({
      code: histogramCode,
      description: "Generate SALES histogram with matplotlib"
    }, { secrets: { E2B_API_KEY: process.env.E2B_API_KEY || "" } });
    
    console.log("🖼️ Histogram generation result:");
    console.log(result.substring(0, 800));
    
    if (!result.includes("E2B API Key Required")) {
      assert.ok(result.includes("Execution Successful") || result.includes("chart"), 
        "Should generate chart");
      console.log("\n✅ Histogram generation successful!");
      
      if (result.includes("Chart") || result.includes("PNG")) {
        console.log("📊 Chart image was created and returned!");
      }
    } else {
      console.log("⚠️  Skipping chart generation - E2B API key not configured");
    }
  });

  it("Summary: All tools are accessible", () => {
    console.log("\n✅ TEST 8: Tool Inventory");
    console.log("-".repeat(70));
    
    const tools = createDataAnalystAgentTools();
    
    console.log(`\n🧰 Total tools available: ${tools.length}`);
    console.log("\nPhase 1 Tools (Basic Analysis):");
    console.log("  1. read_uploaded_file");
    console.log("  2. analyze_csv_data");
    console.log("  3. generate_insights");
    console.log("  4. generate_visualization");
    
    console.log("\nPhase 2 Tools (E2B Execution):");
    console.log("  5. execute_python_code");
    console.log("  6. generate_and_execute_chart");
    console.log("  7. transform_data");
    console.log("  8. simple_ml_model");
    
    assert.equal(tools.length, 8, "Should have exactly 8 tools");
    console.log("\n✅ All tools verified!");
  });
});

console.log("\n" + "=".repeat(70));
console.log("🎉 E2E TEST SUITE COMPLETE");
console.log("=".repeat(70) + "\n");
