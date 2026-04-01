import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DataAnalystAgentConfig } from "@/lib/agents/dataAnalystAgent/config";
import { dataAnalystAgentSystemPrompt } from "@/lib/agents/dataAnalystAgent/prompt";
import { agentUserMetadataList } from "@/lib/agents/user_metadata";
import { chatModels } from "@/lib/ai/models";

/**
 * Tests for lib/agents/dataAnalystAgent/tools.ts
 *
 * Real exports:
 *   createDataAnalystAgentTools(runtimeSecrets?) — returns all 8 tools
 *
 * Tool names:
 *   read_uploaded_file       — fetches and parses a file from a Vercel Blob URL
 *   analyze_csv_data         — statistical analysis engine for CSV strings
 *   generate_insights        — generates insights and recommendations from CSV data
 *   generate_visualization   — generates Python matplotlib/seaborn chart code
 *   execute_python_code      — executes Python code in E2B sandbox
 *   generate_and_execute_chart — generates and executes a chart via E2B
 *   transform_data           — performs pandas transformations via E2B
 *   simple_ml_model          — trains and evaluates ML models via E2B
 *
 * We mock e2bHelper (returning null API key so E2B tools fall back gracefully)
 * and papaparse, and stub global fetch so no real HTTP calls are made.
 */

const DEFAULT_PARSE_RESULT = {
  data: [
    { Name: "Alice", Age: "30", Score: "88.5" },
    { Name: "Bob", Age: "25", Score: "72.0" },
    { Name: "Carol", Age: "35", Score: "95.0" },
  ],
  meta: { fields: ["Name", "Age", "Score"] },
  errors: [],
};

let mockedParseResult = DEFAULT_PARSE_RESULT;

function createE2BHelperMock() {
  return {
    getE2BApiKey: vi.fn().mockReturnValue(null),
    createSandbox: vi.fn(),
    executePythonCode: vi.fn(),
    uploadCsvToSandbox: vi.fn(),
    generateAnalysisTemplate: vi.fn(),
  };
}

vi.mock("@/lib/agents/dataAnalystAgent/e2bHelper", () => createE2BHelperMock());

vi.mock("papaparse", () => ({
  default: {
    parse: vi.fn(() => mockedParseResult),
  },
}));

const SAMPLE_CSV = `Name,Age,Score
Alice,30,88.5
Bob,25,72.0
Carol,35,95.0`;

vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: vi.fn().mockReturnValue("text/csv") },
    text: vi.fn().mockResolvedValue(SAMPLE_CSV),
    json: vi.fn().mockResolvedValue({}),
  })
);

describe("DataAnalystAgent Tools", () => {
  let mod: typeof import("@/lib/agents/dataAnalystAgent/tools");

  beforeEach(async () => {
    vi.resetModules();
    mockedParseResult = DEFAULT_PARSE_RESULT;
    vi.mock("@/lib/agents/dataAnalystAgent/e2bHelper", () => createE2BHelperMock());
    vi.mock("papaparse", () => ({
      default: {
        parse: vi.fn(() => mockedParseResult),
      },
    }));
    mod = await import("@/lib/agents/dataAnalystAgent/tools");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --- createDataAnalystAgentTools() ---

  it("uses Google Gemini 2.5 Flash", () => {
    expect(DataAnalystAgentConfig.implementation_metadata.provider).toBe("google");
    expect(DataAnalystAgentConfig.implementation_metadata.modelID).toBe(
      "gemini-2.5-flash"
    );
  });

  it("prompt includes statistical analysis capabilities", () => {
    expect(dataAnalystAgentSystemPrompt).toMatch(/statistical/i);
    expect(dataAnalystAgentSystemPrompt).toMatch(/correlation/i);
    expect(dataAnalystAgentSystemPrompt).toMatch(/insights/i);
    expect(dataAnalystAgentSystemPrompt).toMatch(/visualization/i);
  });

  it("is registered in metadata and chat models", () => {
    expect(
      agentUserMetadataList.some((agent) => agent.id === "data-analyst-agent")
    ).toBe(true);
    expect(chatModels.some((model) => model.id === "data-analyst-agent")).toBe(
      true
    );
  });

  it("createDataAnalystAgentTools() returns a non-empty array", () => {
    const tools = mod.createDataAnalystAgentTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it("createDataAnalystAgentTools() returns exactly 8 tools", () => {
    const tools = mod.createDataAnalystAgentTools();
    expect(tools.length).toBe(8);
  });

  it("every tool has a non-empty name and description", () => {
    const tools = mod.createDataAnalystAgentTools();
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it("createDataAnalystAgentTools() with runtimeSecrets still returns 8 tools", () => {
    const tools = mod.createDataAnalystAgentTools({ E2B_API_KEY: "test-key" });
    expect(tools.length).toBe(8);
  });

  // --- read_uploaded_file ---

  it("read_uploaded_file tool is present with correct name", () => {
    const tools = mod.createDataAnalystAgentTools();
    expect(tools.find((t) => t.name === "read_uploaded_file")).toBeDefined();
  });

  it("read_uploaded_file invoke returns a non-empty string", async () => {
    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "read_uploaded_file")!;
    const result = await tool.invoke({ fileUrl: "https://example.com/data.csv" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("read_uploaded_file returns a string when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" })
    );
    const freshMod = await import("@/lib/agents/dataAnalystAgent/tools");
    const tool = freshMod.createDataAnalystAgentTools().find((t) => t.name === "read_uploaded_file")!;
    const result = await tool.invoke({ fileUrl: "https://example.com/missing.csv" });
    expect(typeof result).toBe("string");
  });

  // --- analyze_csv_data ---

  it("analyze_csv_data tool is present with correct name", () => {
    const tools = mod.createDataAnalystAgentTools();
    expect(tools.find((t) => t.name === "analyze_csv_data")).toBeDefined();
  });

  it("analyze_csv_data invoke returns a non-empty string", async () => {
    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "analyze_csv_data")!;
    const result = await tool.invoke({ csvData: SAMPLE_CSV });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("analyze_csv_data invoke with focusColumns returns a string", async () => {
    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "analyze_csv_data")!;
    const result = await tool.invoke({ csvData: SAMPLE_CSV, focusColumns: ["Age", "Score"] });
    expect(typeof result).toBe("string");
  });

  it("detects categorical columns correctly", async () => {
    mockedParseResult = {
      data: [
        { Product: "Widget A", Category: "Electronics", Sales: "100" },
        { Product: "Widget B", Category: "Home", Sales: "200" },
        { Product: "Widget C", Category: "Electronics", Sales: "150" },
        { Product: "Widget D", Category: "Sports", Sales: "180" },
      ],
      meta: { fields: ["Product", "Category", "Sales"] },
      errors: [],
    };

    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "analyze_csv_data")!;
    const result = await tool.invoke({ csvData: "placeholder" });

    expect(result).toContain("Category");
    expect(result).toMatch(/categorical/i);
    expect(result).toContain("Unique Values");
  });

  it("calculates correlations between numeric columns", async () => {
    mockedParseResult = {
      data: [
        { x: "1", y: "2" },
        { x: "2", y: "4" },
        { x: "3", y: "6" },
        { x: "4", y: "8" },
        { x: "5", y: "10" },
      ],
      meta: { fields: ["x", "y"] },
      errors: [],
    };

    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "analyze_csv_data")!;
    const result = await tool.invoke({ csvData: "placeholder" });

    expect(result).toContain("Correlations");
    expect(result).toMatch(/x.*y/i);
  });

  it("handles missing values", async () => {
    mockedParseResult = {
      data: [
        { Name: "Alice", Score: "85" },
        { Name: "Bob", Score: "" },
        { Name: "Charlie", Score: "92" },
        { Name: "Diana", Score: "78" },
        { Name: "Eve", Score: "" },
      ],
      meta: { fields: ["Name", "Score"] },
      errors: [],
    };

    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "analyze_csv_data")!;
    const result = await tool.invoke({ csvData: "placeholder" });

    expect(result).toContain("Missing: 2");
  });

  // --- generate_insights ---

  it("generate_insights tool is present with correct name", () => {
    const tools = mod.createDataAnalystAgentTools();
    expect(tools.find((t) => t.name === "generate_insights")).toBeDefined();
  });

  it("generate_insights invoke returns a non-empty string", async () => {
    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "generate_insights")!;
    const result = await tool.invoke({ csvData: SAMPLE_CSV });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("generate_insights invoke with context returns a string", async () => {
    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "generate_insights")!;
    const result = await tool.invoke({ csvData: SAMPLE_CSV, context: "Analyse student performance" });
    expect(typeof result).toBe("string");
  });

  it("detects missing value patterns", async () => {
    mockedParseResult = {
      data: [
        { Product: "A", Sales: "100", Price: "10" },
        { Product: "B", Sales: "200", Price: "20" },
        { Product: "C", Sales: "150", Price: "15" },
        { Product: "D", Sales: "", Price: "" },
        { Product: "E", Sales: "180", Price: "18" },
        { Product: "F", Sales: "", Price: "" },
      ],
      meta: { fields: ["Product", "Sales", "Price"] },
      errors: [],
    };

    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "generate_insights")!;
    const result = await tool.invoke({ csvData: "placeholder" });

    expect(result).toMatch(/missing/i);
    expect(result).toContain("Insights");
  });

  it("identifies outliers", async () => {
    mockedParseResult = {
      data: [
        { id: "1", value: "10" },
        { id: "2", value: "12" },
        { id: "3", value: "11" },
        { id: "4", value: "13" },
        { id: "5", value: "12" },
        { id: "6", value: "100" },
        { id: "7", value: "11" },
      ],
      meta: { fields: ["id", "value"] },
      errors: [],
    };

    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "generate_insights")!;
    const result = await tool.invoke({ csvData: "placeholder" });

    expect(result).toMatch(/outlier/i);
  });

  // --- generate_visualization ---

  it("generate_visualization tool is present with correct name", () => {
    const tools = mod.createDataAnalystAgentTools();
    expect(tools.find((t) => t.name === "generate_visualization")).toBeDefined();
  });

  it("generate_visualization returns Python code string for bar chart", async () => {
    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "generate_visualization")!;
    const result = await tool.invoke({ chartType: "bar", columns: ["Score"] });
    expect(typeof result).toBe("string");
    expect(result).toContain("plt");
  });

  it("generate_visualization returns Python code string for scatter chart", async () => {
    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "generate_visualization")!;
    const result = await tool.invoke({ chartType: "scatter", columns: ["Age", "Score"], title: "Age vs Score" });
    expect(typeof result).toBe("string");
    expect(result).toContain("scatter");
  });

  it("generates heatmap code for correlations", async () => {
    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "generate_visualization")!;
    const result = await tool.invoke({
      chartType: "heatmap",
      columns: ["col1", "col2", "col3"],
    });

    expect(result).toContain("sns.heatmap");
    expect(result).toContain("corr()");
    expect(result).toContain("annot=True");
  });

  it("includes usage instructions in generated code", async () => {
    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "generate_visualization")!;
    const result = await tool.invoke({
      chartType: "histogram",
      columns: ["Score"],
      title: "Score Distribution",
    });

    expect(result).toContain("Usage Instructions");
    expect(result).toContain("pip install matplotlib seaborn pandas");
  });

  // --- E2B tools — graceful fallback when no API key ---

  it("execute_python_code tool is present with correct name", () => {
    const tools = mod.createDataAnalystAgentTools();
    expect(tools.find((t) => t.name === "execute_python_code")).toBeDefined();
  });

  it("execute_python_code returns a string when no E2B key is configured", async () => {
    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "execute_python_code")!;
    const result = await tool.invoke({ code: "print('hello')", description: "test" });
    expect(typeof result).toBe("string");
  });

  it("generate_and_execute_chart tool is present with correct name", () => {
    const tools = mod.createDataAnalystAgentTools();
    expect(tools.find((t) => t.name === "generate_and_execute_chart")).toBeDefined();
  });

  it("generate_and_execute_chart returns a string when no E2B key is configured", async () => {
    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "generate_and_execute_chart")!;
    const result = await tool.invoke({
      csvUrl: "https://example.com/data.csv",
      chartType: "bar",
      columns: ["Score"],
    });
    expect(typeof result).toBe("string");
  });

  it("transform_data tool is present with correct name", () => {
    const tools = mod.createDataAnalystAgentTools();
    expect(tools.find((t) => t.name === "transform_data")).toBeDefined();
  });

  it("transform_data returns a string when no E2B key is configured", async () => {
    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "transform_data")!;
    const result = await tool.invoke({
      csvUrl: "https://example.com/data.csv",
      operation: "sort",
      parameters: { column: "Score" },
    });
    expect(typeof result).toBe("string");
  });

  it("simple_ml_model tool is present with correct name", () => {
    const tools = mod.createDataAnalystAgentTools();
    expect(tools.find((t) => t.name === "simple_ml_model")).toBeDefined();
  });

  it("simple_ml_model returns a string when no E2B key is configured", async () => {
    const tools = mod.createDataAnalystAgentTools();
    const tool = tools.find((t) => t.name === "simple_ml_model")!;
    const result = await tool.invoke({
      csvUrl: "https://example.com/data.csv",
      modelType: "linear_regression",
      targetColumn: "Score",
      featureColumns: ["Age"],
    });
    expect(typeof result).toBe("string");
  });
});
