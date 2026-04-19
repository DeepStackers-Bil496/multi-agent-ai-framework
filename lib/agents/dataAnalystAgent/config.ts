import { AgentConfig } from "../agentConfig";
import { FiPieChart } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import type { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { dataAnalystAgentSystemPrompt } from "./prompt";

const dataAnalystAgentUserMetadata: AgentUserMetadata = {
  id: "data-analyst-agent",
  name: "Data Analyst Agent",
  short_description: "Statistics, charts, transformations, and ML on tabular data.",
  long_description:
    "Ingests CSV/JSON (uploaded file or pasted text), computes statistics and correlations, detects outliers, runs pandas transformations, renders real charts, and trains baseline ML models (regression, classification, feature importance). Python execution via E2B sandbox when configured.",
  icon: FiPieChart,
  suggestedActions: [
    "Give me summary statistics for this CSV.",
    "Find the strongest correlations between the numeric columns.",
    "Plot a histogram of the SALES column.",
    "Train a random-forest model to predict `churn` and report feature importance.",
    "Group by Region, aggregate Sales sum, and show the top 5.",
    "Detect outliers in the `price` column using IQR.",
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
