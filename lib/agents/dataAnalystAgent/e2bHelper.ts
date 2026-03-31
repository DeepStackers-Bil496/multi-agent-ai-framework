/**
 * E2B Code Interpreter Helper Utilities
 * Provides shared functions for Python code execution via E2B sandbox
 */

import { Sandbox } from "@e2b/code-interpreter";

/**
 * Get E2B API key from runtime secrets or environment
 */
export function getE2BApiKey(runtimeSecrets?: Record<string, string>): string {
  return runtimeSecrets?.E2B_API_KEY || process.env.E2B_API_KEY || "";
}

/**
 * Create a new E2B sandbox instance
 * @param apiKey E2B API key
 * @returns Sandbox instance
 */
export async function createSandbox(apiKey: string): Promise<Sandbox> {
  if (!apiKey) {
    throw new Error("E2B_API_KEY is required for Python execution. Please add it to your environment variables or agent secrets.");
  }
  
  const sandbox = await Sandbox.create({ apiKey });
  return sandbox;
}

/**
 * Execute Python code in E2B sandbox
 * @param code Python code to execute
 * @param apiKey E2B API key
 * @returns Execution result with stdout, stderr, and artifacts
 */
export async function executePythonCode(
  code: string,
  apiKey: string
): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  charts?: Array<{ format: string; data: string }>;
}> {
  let sandbox: Sandbox | null = null;
  
  try {
    sandbox = await createSandbox(apiKey);
    
    const execution = await sandbox.runCode(code);
    
    // Collect outputs
    const stdout = execution.logs.stdout.join("\n");
    const stderr = execution.logs.stderr.join("\n");
    
    // Collect chart artifacts (PNG, SVG, etc.)
    const charts = execution.results.map(result => {
      if (result.png) {
        return { format: "png", data: result.png };
      }
      if (result.svg) {
        return { format: "svg", data: result.svg };
      }
      if (result.jpeg) {
        return { format: "jpeg", data: result.jpeg };
      }
      return null;
    }).filter(Boolean) as Array<{ format: string; data: string }>;
    
    const success = execution.error === null || execution.error === undefined;
    
    return {
      success,
      stdout,
      stderr,
      error: execution.error?.value || undefined,
      charts,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      stdout: "",
      stderr: "",
      error: errorMessage,
    };
  } finally {
    if (sandbox) {
      await sandbox.kill();
    }
  }
}

/**
 * Upload CSV data to E2B sandbox and return file path
 * @param csvData CSV content as string
 * @param sandbox Sandbox instance
 * @param filename Optional filename (default: 'data.csv')
 * @returns Path to uploaded file in sandbox
 */
export async function uploadCsvToSandbox(
  csvData: string,
  sandbox: Sandbox,
  filename: string = "data.csv"
): Promise<string> {
  const filePath = `/home/user/${filename}`;
  await sandbox.files.write(filePath, csvData);
  return filePath;
}

/**
 * Generate Python code template for data analysis
 */
export function generateAnalysisTemplate(
  filePath: string,
  analysisType: "summary" | "correlation" | "distribution" | "trends"
): string {
  const templates = {
    summary: `import pandas as pd
import numpy as np

# Load data
df = pd.read_csv('${filePath}')

# Basic info
print("Dataset Shape:", df.shape)
print("\\nColumn Types:")
print(df.dtypes)

# Summary statistics
print("\\nSummary Statistics:")
print(df.describe())

# Missing values
print("\\nMissing Values:")
print(df.isnull().sum())
`,
    correlation: `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# Load data
df = pd.read_csv('${filePath}')

# Select numeric columns
numeric_df = df.select_dtypes(include=[np.number])

# Correlation matrix
print("Correlation Matrix:")
corr = numeric_df.corr()
print(corr)

# Heatmap
plt.figure(figsize=(10, 8))
sns.heatmap(corr, annot=True, cmap='coolwarm', center=0, square=True, linewidths=1)
plt.title('Correlation Heatmap', fontsize=16, fontweight='bold')
plt.tight_layout()
plt.show()
`,
    distribution: `import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Load data
df = pd.read_csv('${filePath}')

# Select numeric columns
numeric_cols = df.select_dtypes(include=['number']).columns

# Create distribution plots
fig, axes = plt.subplots(len(numeric_cols), 2, figsize=(12, 4*len(numeric_cols)))
if len(numeric_cols) == 1:
    axes = axes.reshape(1, -1)

for i, col in enumerate(numeric_cols):
    # Histogram
    axes[i, 0].hist(df[col].dropna(), bins=30, edgecolor='black', alpha=0.7)
    axes[i, 0].set_title(f'{col} - Histogram')
    axes[i, 0].set_xlabel(col)
    axes[i, 0].set_ylabel('Frequency')
    
    # Box plot
    axes[i, 1].boxplot(df[col].dropna())
    axes[i, 1].set_title(f'{col} - Box Plot')
    axes[i, 1].set_ylabel(col)

plt.tight_layout()
plt.show()
`,
    trends: `import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Load data
df = pd.read_csv('${filePath}')

# Auto-detect time column
time_cols = [col for col in df.columns if 'date' in col.lower() or 'time' in col.lower() or 'year' in col.lower()]

if time_cols:
    time_col = time_cols[0]
    numeric_cols = df.select_dtypes(include=['number']).columns
    
    # Convert to datetime if needed
    try:
        df[time_col] = pd.to_datetime(df[time_col])
        df = df.sort_values(time_col)
    except:
        pass
    
    # Plot trends
    for col in numeric_cols:
        plt.figure(figsize=(12, 6))
        plt.plot(df[time_col], df[col], marker='o', linewidth=2)
        plt.title(f'{col} over {time_col}', fontsize=14, fontweight='bold')
        plt.xlabel(time_col)
        plt.ylabel(col)
        plt.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.show()
else:
    print("No time column detected in dataset")
`,
  };
  
  return templates[analysisType];
}
