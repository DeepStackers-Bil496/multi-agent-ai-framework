import { AgentConfig } from "../agentConfig";
import { FiPieChart } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import type { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { dataAnalystAgentSystemPrompt } from "./prompt";

const dataAnalystAgentUserMetadata: AgentUserMetadata = {
  id: "data-analyst-agent",
  name: "Data Analyst Agent",
  short_description: "Expert in data cleaning, analysis, and professional visualizations.",
  long_description:
    "Specialized agent for data science tasks. It can clean messy datasets, perform statistical analysis, and generate beautiful charts using Python.",
  icon: FiPieChart,
  suggestedActions: [
    "Clean this CSV data and handle missing values.",
    "Show me the correlation between sales and marketing spend.",
    "Create a bar chart showing the monthly revenue trend.",
    "What are the key insights from this dataset?",
  ],
};

const dataAnalystAgentImplementationMetadata: LLMImplMetadata = {
  type: API_MODEL_TYPE,
  provider: "google",
  modelID: "gemini-1.5-flash",
  systemInstruction: dataAnalystAgentSystemPrompt,
  apiKey: process.env.GEMINI_API_KEY,
};

export const DataAnalystAgentConfig: AgentConfig<LLMImplMetadata> = {
  user_metadata: dataAnalystAgentUserMetadata,
  implementation_metadata: dataAnalystAgentImplementationMetadata,
};
