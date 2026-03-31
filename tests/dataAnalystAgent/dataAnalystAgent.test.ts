import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DataAnalystAgentConfig } from "../../lib/agents/dataAnalystAgent/config";
import { dataAnalystAgentSystemPrompt } from "../../lib/agents/dataAnalystAgent/prompt";
import { agentUserMetadataList } from "../../lib/agents/user_metadata";
import { chatModels } from "../../lib/ai/models";
import { createDataAnalystAgentTools } from "../../lib/agents/dataAnalystAgent/tools";

const DATA_ANALYST_AGENT_ID = "data-analyst-agent";

describe("Data Analyst Agent - Configuration", () => {
  it("uses Google Gemini 2.0 Flash Exp", () => {
    assert.equal(DataAnalystAgentConfig.implementation_metadata.provider, "google");
    assert.equal(DataAnalystAgentConfig.implementation_metadata.modelID, "gemini-2.0-flash-exp");
  });

  it("prompt includes statistical analysis capabilities", () => {
    assert.match(dataAnalystAgentSystemPrompt, /statistical/i);
    assert.match(dataAnalystAgentSystemPrompt, /correlation/i);
    assert.match(dataAnalystAgentSystemPrompt, /insights/i);
    assert.match(dataAnalystAgentSystemPrompt, /visualization/i);
  });

  it("is registered in metadata and chat models", () => {
    const inMetadata = agentUserMetadataList.some((agent) => agent.id === DATA_ANALYST_AGENT_ID);
    const inChatModels = chatModels.some((model) => model.id === DATA_ANALYST_AGENT_ID);
    assert.ok(inMetadata, "agentUserMetadataList should include data-analyst-agent");
    assert.ok(inChatModels, "chatModels should include data-analyst-agent");
  });
});

describe("Data Analyst Agent - Tools", () => {
  it("exposes 8 analysis tools (Phase 1 + Phase 2)", () => {
    const tools = createDataAnalystAgentTools();
    assert.equal(tools.length, 8, "Should have 8 tools total (4 from Phase 1, 4 from Phase 2)");
    
    const toolNames = tools.map((tool) => tool.name);
    
    // Phase 1 tools (basic analysis, no execution)
    assert.ok(toolNames.includes("read_uploaded_file"), "Should have read_uploaded_file tool");
    assert.ok(toolNames.includes("analyze_csv_data"), "Should have analyze_csv_data tool");
    assert.ok(toolNames.includes("generate_insights"), "Should have generate_insights tool");
    assert.ok(toolNames.includes("generate_visualization"), "Should have generate_visualization tool");
    
    // Phase 2 tools (E2B execution)
    assert.ok(toolNames.includes("execute_python_code"), "Should have execute_python_code tool");
    assert.ok(toolNames.includes("generate_and_execute_chart"), "Should have generate_and_execute_chart tool");
    assert.ok(toolNames.includes("transform_data"), "Should have transform_data tool");
    assert.ok(toolNames.includes("simple_ml_model"), "Should have simple_ml_model tool");
  });
});

describe("Data Analyst Agent - CSV Analysis", () => {
  it("analyze_csv_data handles basic numeric dataset", async () => {
    const tools = createDataAnalystAgentTools();
    const analyzeTool = tools.find(t => t.name === "analyze_csv_data");
    assert.ok(analyzeTool, "analyze_csv_data tool should exist");

    const sampleCsv = `name,age,salary
Alice,25,50000
Bob,30,60000
Charlie,35,70000
Diana,28,55000
Eve,32,65000`;

    const result = await analyzeTool.func({ csvData: sampleCsv });
    
    // Check dataset overview
    assert.match(result, /Total Rows: 5/, "Should report 5 rows");
    assert.match(result, /Total Columns: 3/, "Should report 3 columns");
    
    // Check numeric columns are identified
    assert.match(result, /age.*numeric/i, "Age should be numeric");
    assert.match(result, /salary.*numeric/i, "Salary should be numeric");
    
    // Check statistics are calculated
    assert.match(result, /Mean/i, "Should calculate mean");
    assert.match(result, /Median/i, "Should calculate median");
    assert.match(result, /Std/i, "Should calculate standard deviation");
    assert.match(result, /Min/i, "Should have min value");
    assert.match(result, /Max/i, "Should have max value");
  });

  it("detects categorical columns correctly",async () => {
    const tools = createDataAnalystAgentTools();
    const analyzeTool = tools.find(t => t.name === "analyze_csv_data");
    assert.ok(analyzeTool);

    const sampleCsv = `product,category,sales
Widget A,Electronics,100
Widget B,Home,200
Widget C,Electronics,150
Widget D,Sports,180`;

    const result = await analyzeTool.func({ csvData: sampleCsv });
    
    assert.match(result, /category.*categorical/i, "Category should be categorical");
    assert.match(result, /Unique Values/i, "Should report unique values for categorical");
  });

  it("calculates correlations between numeric columns", async () => {
    const tools = createDataAnalystAgentTools();
    const analyzeTool = tools.find(t => t.name === "analyze_csv_data");
    assert.ok(analyzeTool);

    // Create data with strong positive correlation
    const sampleCsv = `x,y
1,2
2,4
3,6
4,8
5,10`;

    const result = await analyzeTool.func({ csvData: sampleCsv });
    
    // Should detect strong correlation
    assert.match(result, /Correlations/i, "Should have correlation section");
    assert.match(result, /x.*y/i, "Should show x-y correlation");
  });

  it("handles missing values", async () => {
    const tools = createDataAnalystAgentTools();
    const analyzeTool = tools.find(t => t.name === "analyze_csv_data");
    assert.ok(analyzeTool);

    const sampleCsv = `name,score
Alice,85
Bob,
Charlie,92
Diana,78
Eve,`;

    const result = await analyzeTool.func({ csvData: sampleCsv });
    
    assert.match(result, /Missing: 2/, "Should detect 2 missing values in score column");
  });
});

describe("Data Analyst Agent - Insights Generation", () => {
  it("detects missing value patterns", async () => {
    const tools = createDataAnalystAgentTools();
    const insightsTool = tools.find(t => t.name === "generate_insights");
    assert.ok(insightsTool, "generate_insights tool should exist");

    const sampleCsv = `product,sales,price
A,100,10
B,200,20
C,150,15
D,,
E,180,18
F,,`;

    const result = await insightsTool.func({ csvData: sampleCsv });
    
    assert.match(result, /missing/i, "Should mention missing values");
    assert.match(result, /Insights/i, "Should generate insights");
  });

  it("identifies outliers", async () => {
    const tools = createDataAnalystAgentTools();
    const insightsTool = tools.find(t => t.name === "generate_insights");
    assert.ok(insightsTool);

    // Create data with clear outlier
    const sampleCsv = `id,value
1,10
2,12
3,11
4,13
5,12
6,100
7,11`;

    const result = await insightsTool.func({ csvData: sampleCsv });
    
    assert.match(result, /outlier/i, "Should detect outlier");
  });
});

describe("Data Analyst Agent - Visualization Code Generation", () => {
  it("generates scatter plot code", async () => {
    const tools = createDataAnalystAgentTools();
    const vizTool = tools.find(t => t.name === "generate_visualization");
    assert.ok(vizTool, "generate_visualization tool should exist");

    const result = await vizTool.func({ 
      chartType: "scatter", 
      columns: ["age", "salary"],
      title: "Age vs Salary Analysis"
    });
    
    assert.match(result, /import matplotlib/i, "Should import matplotlib");
    assert.match(result, /plt\.scatter/i, "Should use scatter plot");
    assert.match(result, /age/i, "Should reference age column");
    assert.match(result, /salary/i, "Should reference salary column");
    assert.match(result, /Age vs Salary/i, "Should include title");
  });

  it("generates heatmap code for correlations", async () => {
    const tools = createDataAnalystAgentTools();
    const vizTool = tools.find(t => t.name === "generate_visualization");
    assert.ok(vizTool);

    const result = await vizTool.func({ 
      chartType: "heatmap", 
      columns: ["col1", "col2", "col3"]
    });
    
    assert.match(result, /sns\.heatmap/i, "Should use seaborn heatmap");
    assert.match(result, /corr\(\)/i, "Should calculate correlation");
    assert.match(result, /annot=True/i, "Should annotate cells");
  });

  it("generates histogram for distribution analysis", async () => {
    const tools = createDataAnalystAgentTools();
    const vizTool = tools.find(t => t.name === "generate_visualization");
    assert.ok(vizTool);

    const result = await vizTool.func({ 
      chartType: "histogram", 
      columns: ["price"]
    });
    
    assert.match(result, /\.hist\(/i, "Should use histogram");
    assert.match(result, /bins/i, "Should specify bins");
  });

  it("includes usage instructions in generated code", async () => {
    const tools = createDataAnalystAgentTools();
    const vizTool = tools.find(t => t.name === "generate_visualization");
    assert.ok(vizTool);

    const result = await vizTool.func({ 
      chartType: "bar", 
      columns: ["category"]
    });
    
    assert.match(result, /Usage Instructions/i, "Should have usage section");
    assert.match(result, /pandas/i, "Should mention pandas requirement");
  });
});

describe("Data Analyst Agent - Phase 2 Tools (E2B Execution)", () => {
  it("execute_python_code tool exists and has correct schema", async () => {
    const tools = createDataAnalystAgentTools();
    const executeTool = tools.find(t => t.name === "execute_python_code");
    
    assert.ok(executeTool, "execute_python_code tool should exist");
    assert.ok(executeTool.description.includes("E2B sandbox"), "Should mention E2B sandbox");
    assert.ok(executeTool.description.includes("pandas"), "Should mention pandas availability");
  });

  it("execute_python_code returns E2B setup message when no API key", async () => {
    const tools = createDataAnalystAgentTools();
    const executeTool = tools.find(t => t.name === "execute_python_code");
    assert.ok(executeTool);

    const result = await executeTool.func({ 
      code: "print('Hello, World!')",
      description: "Test execution"
    }, { secrets: {} });
    
    assert.match(result, /E2B API Key/i, "Should mention API key requirement");
    assert.match(result, /e2b\.dev/i, "Should provide E2B website link");
  });

  it("generate_and_execute_chart tool exists with correct chart types", async () => {
    const tools = createDataAnalystAgentTools();
    const chartTool = tools.find(t => t.name === "generate_and_execute_chart");
    
    assert.ok(chartTool, "generate_and_execute_chart tool should exist");
    assert.ok(chartTool.description.includes("actual image"), "Should mention actual image generation");
  });

  it("transform_data tool supports multiple operation types", async () => {
    const tools = createDataAnalystAgentTools();
    const transformTool = tools.find(t => t.name === "transform_data");
    
    assert.ok(transformTool, "transform_data tool should exist");
    assert.ok(transformTool.description.includes("Filter"), "Should support filter");
    assert.ok(transformTool.description.includes("Group"), "Should support groupby");
    assert.ok(transformTool.description.includes("Pivot"), "Should support pivot");
  });

  it("simple_ml_model tool supports regression and classification", async () => {
    const tools = createDataAnalystAgentTools();
    const mlTool = tools.find(t => t.name === "simple_ml_model");
    
    assert.ok(mlTool, "simple_ml_model tool should exist");
    assert.ok(mlTool.description.includes("linear_regression"), "Should support linear regression");
    assert.ok(mlTool.description.includes("logistic_regression"), "Should support logistic regression");
    assert.ok(mlTool.description.includes("random_forest"), "Should support random forest");
  });
});

describe("Data Analyst Agent - E2B Helper Functions", () => {
  it("e2bHelper module is importable", async () => {
    const { getE2BApiKey } = await import("../../lib/agents/dataAnalystAgent/e2bHelper");
    assert.ok(typeof getE2BApiKey === "function", "getE2BApiKey should be a function");
  });

  it("getE2BApiKey prioritizes runtimeSecrets over environment", async () => {
    const { getE2BApiKey } = await import("../../lib/agents/dataAnalystAgent/e2bHelper");
    
    const result = getE2BApiKey({ E2B_API_KEY: "secret-key-123" });
    assert.equal(result, "secret-key-123", "Should use runtime secret when provided");
  });

  it("generateAnalysisTemplate produces valid Python code", async () => {
    const { generateAnalysisTemplate } = await import("../../lib/agents/dataAnalystAgent/e2bHelper");
    
    const code = generateAnalysisTemplate("/home/user/data.csv", "summary");
    
    assert.ok(code.includes("import pandas as pd"), "Should import pandas");
    assert.ok(code.includes("read_csv"), "Should read CSV");
    assert.ok(code.includes("describe()"), "Should include describe() for summary");
  });

  it("generateAnalysisTemplate supports correlation analysis", async () => {
    const { generateAnalysisTemplate } = await import("../../lib/agents/dataAnalystAgent/e2bHelper");
    
    const code = generateAnalysisTemplate("/home/user/data.csv", "correlation");
    
    assert.ok(code.includes("corr()"), "Should calculate correlation");
    assert.ok(code.includes("heatmap"), "Should generate heatmap");
    assert.ok(code.includes("import seaborn"), "Should import seaborn");
  });
});
