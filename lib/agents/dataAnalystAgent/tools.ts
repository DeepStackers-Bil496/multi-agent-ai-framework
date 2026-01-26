import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Tool for reading uploaded files (from Vercel Blob)
 */
const readUploadedFileTool = new DynamicStructuredTool({
  name: "read_uploaded_file",
  description: `Read the content of an uploaded file (CSV, Excel, or text file).
Use this when the user has uploaded a file and you need to access its content.
The file URL will be in the user's message attachments.`,
  schema: z.object({
    fileUrl: z.string().url().describe("The URL of the uploaded file (from Vercel Blob or similar)"),
  }),
  func: async ({ fileUrl }) => {
    try {
      // Fetch with proper headers for Vercel Blob
      const response = await fetch(fileUrl, {
        headers: {
          // Vercel Blob public URLs should work without auth, but include standard headers
          'Accept': 'text/csv, application/json, text/plain, */*',
        },
      });
      
      if (!response.ok) {
        return `Error reading file: HTTP ${response.status} ${response.statusText}. Please ensure the file URL is publicly accessible.`;
      }

      const contentType = response.headers.get("content-type") || "";
      
      if (contentType.includes("application/json")) {
        const jsonData = await response.json();
        const preview = JSON.stringify(jsonData, null, 2).slice(0, 5000);
        return `File content (JSON):\n\n\`\`\`json\n${preview}\n\`\`\`\n\n${jsonData.length > 5000 ? "(Truncated - showing first 5000 characters)" : ""}`;
      } else {
        // Assume CSV or text
        const textData = await response.text();
        const lines = textData.split('\n');
        
        // Show first 100 lines to avoid token overflow
        const preview = lines.slice(0, 100).join('\n');
        const truncated = lines.length > 100 ? `\n... (${lines.length - 100} more lines)` : "";
        
        return `File content:\n\n\`\`\`csv\n${preview}${truncated}\n\`\`\`\n\nTotal lines: ${lines.length}`;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `Error reading uploaded file: ${errorMessage}`;
    }
  },
});

/**
 * Tool for fetching data from a URL
 */
const fetchDataFromUrlTool = new DynamicStructuredTool({
  name: "fetch_data_from_url",
  description: `Fetch CSV or JSON data from a public URL. Use this when the user provides a URL to a dataset.
Supports: CSV files, JSON files, and API endpoints returning tabular data.`,
  schema: z.object({
    url: z.string().url().describe("The URL to fetch data from (must be publicly accessible)"),
  }),
  func: async ({ url }) => {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        return `Error fetching data: HTTP ${response.status} ${response.statusText}`;
      }

      const contentType = response.headers.get("content-type") || "";
      
      if (contentType.includes("application/json")) {
        const jsonData = await response.json();
        return `Successfully fetched JSON data:\n\n\`\`\`json\n${JSON.stringify(jsonData, null, 2).slice(0, 5000)}\n\`\`\`\n\n(Truncated if data is large)`;
      } else {
        // Assume CSV or text
        const textData = await response.text();
        // Return first 5000 chars to avoid token overflow
        const truncated = textData.length > 5000 ? textData.slice(0, 5000) + "\n... (truncated)" : textData;
        return `Successfully fetched CSV/text data:\n\n\`\`\`csv\n${truncated}\n\`\`\``;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `Error fetching data from URL: ${errorMessage}. Make sure the URL is publicly accessible and returns CSV or JSON data.`;
    }
  },
});

/**
 * Tool for analyzing datasets
 */
const analyzeDatasetTool = new DynamicStructuredTool({
  name: "analyze_dataset",
  description: `Analyze a dataset (CSV, JSON, or tabular data) to provide statistical insights, correlations, and summary statistics.
Use this when the user wants to understand their data better, find patterns, or get descriptive statistics.`,
  schema: z.object({
    data: z.string().describe("The dataset content as a string (CSV format or JSON)"),
    analysisType: z.enum(["summary", "correlation", "missing_values", "outliers"]).describe("Type of analysis to perform"),
  }),
  func: async ({ data, analysisType }) => {
    try {
      // For now, return a placeholder response
      // In a real implementation, this would use Python execution or a data processing library
      return `Dataset analysis (${analysisType}) completed. 
Note: Full data analysis capabilities require Python execution environment.
For now, please use the conversation to describe your data and I'll provide analysis code.`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `Error analyzing dataset: ${errorMessage}`;
    }
  },
});

/**
 * Tool for generating visualization code
 */
const generateVisualizationTool = new DynamicStructuredTool({
  name: "generate_visualization",
  description: `Generate Python code for data visualization using matplotlib, seaborn, or plotly.
Use this when the user wants to create charts like bar charts, line plots, scatter plots, histograms, etc.`,
  schema: z.object({
    chartType: z.enum(["bar", "line", "scatter", "histogram", "pie", "heatmap", "box"]).describe("Type of chart to generate"),
    dataDescription: z.string().describe("Description of the data to be visualized (column names, data structure)"),
  }),
  func: async ({ chartType, dataDescription }) => {
    try {
      // Generate appropriate Python code based on chart type
      const codeTemplates: Record<string, string> = {
        bar: `import matplotlib.pyplot as plt
import pandas as pd

# Assuming df is your DataFrame
# ${dataDescription}

plt.figure(figsize=(10, 6))
df.plot(kind='bar')
plt.title('Bar Chart')
plt.xlabel('Categories')
plt.ylabel('Values')
plt.tight_layout()
plt.show()`,
        line: `import matplotlib.pyplot as plt
import pandas as pd

# ${dataDescription}

plt.figure(figsize=(10, 6))
df.plot(kind='line')
plt.title('Line Chart')
plt.xlabel('X-axis')
plt.ylabel('Y-axis')
plt.tight_layout()
plt.show()`,
        scatter: `import matplotlib.pyplot as plt
import pandas as pd

# ${dataDescription}

plt.figure(figsize=(10, 6))
plt.scatter(df['x_column'], df['y_column'])
plt.title('Scatter Plot')
plt.xlabel('X-axis')
plt.ylabel('Y-axis')
plt.tight_layout()
plt.show()`,
        histogram: `import matplotlib.pyplot as plt
import pandas as pd

# ${dataDescription}

plt.figure(figsize=(10, 6))
df['column'].hist(bins=30)
plt.title('Histogram')
plt.xlabel('Value')
plt.ylabel('Frequency')
plt.tight_layout()
plt.show()`,
        pie: `import matplotlib.pyplot as plt
import pandas as pd

# ${dataDescription}

plt.figure(figsize=(10, 6))
df['column'].value_counts().plot(kind='pie', autopct='%1.1f%%')
plt.title('Pie Chart')
plt.ylabel('')
plt.tight_layout()
plt.show()`,
        heatmap: `import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd

# ${dataDescription}

plt.figure(figsize=(10, 8))
sns.heatmap(df.corr(), annot=True, cmap='coolwarm', center=0)
plt.title('Correlation Heatmap')
plt.tight_layout()
plt.show()`,
        box: `import matplotlib.pyplot as plt
import pandas as pd

# ${dataDescription}

plt.figure(figsize=(10, 6))
df.boxplot()
plt.title('Box Plot')
plt.ylabel('Values')
plt.tight_layout()
plt.show()`,
      };

      const code = codeTemplates[chartType] || codeTemplates.bar;
      return `Generated ${chartType} chart code:\n\n\`\`\`python\n${code}\n\`\`\``;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `Error generating visualization: ${errorMessage}`;
    }
  },
});

/**
 * DataAnalystAgent tools.
 * Provides tools for data analysis and visualization.
 */
export function createDataAnalystAgentTools(_runtimeSecrets?: Record<string, string>): DynamicStructuredTool[] {
  return [
    readUploadedFileTool,
    fetchDataFromUrlTool,
    analyzeDatasetTool,
    generateVisualizationTool,
  ];
}
