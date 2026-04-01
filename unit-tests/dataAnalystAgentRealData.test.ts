import { describe, expect, it } from "vitest";
import { createDataAnalystAgentTools } from "@/lib/agents/dataAnalystAgent/tools";

const SALES_SAMPLE_CSV = `ORDERNUMBER,QUANTITYORDERED,PRICEEACH,SALES,ORDERDATE,STATUS,MONTH_ID,YEAR_ID,PRODUCTLINE
10107,30,95.7,2871,2/24/2003,Shipped,2,2003,Motorcycles
10121,34,81.35,2765.9,5/7/2003,Shipped,5,2003,Motorcycles
10134,41,94.74,3884.34,7/1/2003,Shipped,7,2003,Motorcycles
10145,45,83.26,3746.7,8/25/2003,Shipped,8,2003,Motorcycles
10159,49,100,4900,10/10/2003,Shipped,10,2003,Motorcycles
10168,36,96.66,3479.76,10/28/2003,Shipped,10,2003,Motorcycles
10180,29,86.13,2497.77,11/11/2003,Shipped,11,2003,Motorcycles
10188,48,100,4800,11/18/2003,Shipped,11,2003,Motorcycles
10201,22,98.57,2168.54,12/1/2003,Shipped,12,2003,Motorcycles
10211,41,100,4100,1/15/2004,Shipped,1,2004,Motorcycles`;

describe("DataAnalystAgent Real Data", () => {
  it("reads and analyzes sales_data_sample.csv", async () => {
    const tools = createDataAnalystAgentTools();
    const analyzeTool = tools.find((tool) => tool.name === "analyze_csv_data");

    expect(analyzeTool).toBeDefined();

    const result = await analyzeTool!.invoke({
      csvData: SALES_SAMPLE_CSV,
      focusColumns: ["SALES"],
    });

    expect(result).toContain("SALES");
    expect(result).toMatch(/Mean/i);
  });

  it("generates insights from the sample sales data", async () => {
    const tools = createDataAnalystAgentTools();
    const insightsTool = tools.find((tool) => tool.name === "generate_insights");

    expect(insightsTool).toBeDefined();

    const result = await insightsTool!.invoke({
      csvData: SALES_SAMPLE_CSV,
      context: "Find patterns in SALES data",
    });

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("generates histogram visualization code for the SALES column", async () => {
    const tools = createDataAnalystAgentTools();
    const vizTool = tools.find((tool) => tool.name === "generate_visualization");

    expect(vizTool).toBeDefined();

    const result = await vizTool!.invoke({
      chartType: "histogram",
      columns: ["SALES"],
      title: "Sales Distribution",
      datasetName: "df",
    });

    expect(result).toMatch(/histogram|hist/i);
    expect(result).toContain("SALES");
    expect(result).toContain("import matplotlib");
  });

  it("execute_python_code returns setup guidance when no API key is configured", async () => {
    const tools = createDataAnalystAgentTools();
    const executeTool = tools.find((tool) => tool.name === "execute_python_code");

    expect(executeTool).toBeDefined();

    const result = await executeTool!.invoke(
      {
        code: "import pandas as pd\nprint('Hello from E2B')",
        description: "Test E2B setup",
      },
      { secrets: {} }
    );

    expect(result).toContain("E2B API Key");
  });

  it("generate_and_execute_chart tool is available in the toolset", () => {
    const tools = createDataAnalystAgentTools();
    const chartTool = tools.find(
      (tool) => tool.name === "generate_and_execute_chart"
    );

    expect(chartTool).toBeDefined();
    expect(chartTool!.description.length).toBeGreaterThan(20);
  });
});
