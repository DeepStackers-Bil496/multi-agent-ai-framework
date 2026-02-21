import { AgentConfig } from "../agentConfig";
import { FiPieChart } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import type { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { dataAnalystAgentSystemPrompt } from "./prompt";

const dataAnalystAgentUserMetadata: AgentUserMetadata = {
  id: "data-analyst-agent",
  name: "Data Analyst Agent",
  short_description: "Advanced data analysis with Python execution, ML, and real-time visualizations.",
  long_description:
    "Expert data scientist agent with dual-phase capabilities:\n" +
    "• PHASE 1: CSV/JSON parsing, descriptive statistics, correlation analysis, outlier detection, insight generation, visualization code\n" +
    "• PHASE 2 (E2B): Python code execution, real chart generation (PNG), pandas transformations, machine learning models (regression, classification), feature importance analysis\n" +
    "Transforms raw data into actionable insights with production-ready analysis.",
  icon: FiPieChart,
  suggestedActions: [
    // Phase 1 actions (always available)
    "Analyze this dataset and show key statistics",
    "Find correlations in my data",
    "Identify outliers and missing values",
    
    // Phase 2 actions (E2B required)
    "Show me a scatter plot of sales vs marketing",
    "Predict future sales using machine learning",
    "Group data by region and visualize totals",
    "Run a regression analysis and show feature importance",
    "Generate a heatmap showing correlations",
    
    // Advanced analysis
    "Which variables influence revenue the most?",
    "Transform this data and calculate weighted averages",
  ],
};

const dataAnalystAgentImplementationMetadata: LLMImplMetadata = {
  type: API_MODEL_TYPE,
  provider: "google",
  modelID: "gemini-2.5-flash", // Using Gemini 2.5 Flash (same as MainAgent)
  systemInstruction: dataAnalystAgentSystemPrompt,
  apiKey: process.env.GEMINI_API_KEY,
};

export const DataAnalystAgentConfig: AgentConfig<LLMImplMetadata> = {
  user_metadata: dataAnalystAgentUserMetadata,
  implementation_metadata: dataAnalystAgentImplementationMetadata,
};
