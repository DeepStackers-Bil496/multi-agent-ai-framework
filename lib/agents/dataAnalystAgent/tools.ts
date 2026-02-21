import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import Papa from "papaparse";
import {
  getE2BApiKey,
  createSandbox,
  executePythonCode,
  uploadCsvToSandbox,
  generateAnalysisTemplate,
} from "./e2bHelper";

// ============================================================================
// HELPER FUNCTIONS FOR STATISTICS
// ============================================================================

/**
 * Calculate mean (average) of numbers
 */
function mean(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * Calculate median (middle value)
 */
function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Calculate standard deviation
 */
function standardDeviation(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const avg = mean(numbers);
  const squareDiffs = numbers.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = mean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);
  
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    denomX += diffX * diffX;
    denomY += diffY * diffY;
  }
  
  if (denomX === 0 || denomY === 0) return 0;
  return numerator / Math.sqrt(denomX * denomY);
}

/**
 * Detect if a string is numeric
 */
function isNumeric(value: any): boolean {
  if (value === null || value === undefined || value === '') return false;
  return !isNaN(parseFloat(value)) && isFinite(value);
}

/**
 * Parse CSV data using papaparse
 */
function parseCSV(csvText: string): { data: any[], fields: string[], error?: string } {
  const result = Papa.parse(csvText.trim(), {
    header: true,
    dynamicTyping: false, // Keep as strings initially
    skipEmptyLines: true,
  });
  
  if (result.errors.length > 0) {
    return {
      data: [],
      fields: [],
      error: result.errors.map(e => e.message).join('; ')
    };
  }
  
  return {
    data: result.data,
    fields: result.meta.fields || [],
  };
}

// ============================================================================
// TOOL 1: READ AND PARSE UPLOADED FILE
// ============================================================================

const readUploadedFileTool = new DynamicStructuredTool({
  name: "read_uploaded_file",
  description: `📤 Use this ONLY when user UPLOADS a file (not when pasting raw data).

**When to use:**
- User message contains: [File: name.csv (text/csv) - URL: https://blob...]
- Extract the URL from this pattern
- Pass URL to fileUrl parameter

**When to SKIP:**
- User pastes raw CSV/JSON text directly in message
- In that case, use analyze_csv_data directly with the pasted text

**Example:**
User: "analyze this [File: data.csv - URL: https://blob.vercel-storage.com/data-abc.csv]"
✅ Call: read_uploaded_file({ fileUrl: "https://blob.vercel-storage.com/data-abc.csv" })
❌ WRONG: read_uploaded_file({ fileUrl: "" })

Returns: Parsed data, row count, column names (CASE-SENSITIVE!), data preview.`,
  schema: z.object({
    fileUrl: z.string().url().describe("The Vercel Blob URL from user's message [File: ... - URL: <THIS_URL>]"),
  }),
  func: async ({ fileUrl }) => {
    console.log('[DataAnalyst] read_uploaded_file called with URL:', fileUrl);
    try {
      const response = await fetch(fileUrl, {
        headers: {
          'Accept': 'text/csv, application/json, text/plain, */*',
        },
      });
      console.log('[DataAnalyst] Fetch response:', response.status, response.statusText);
      
      if (!response.ok) {
        return `❌ Error reading file: HTTP ${response.status} ${response.statusText}.\nPlease ensure the file URL is publicly accessible.`;
      }

      const contentType = response.headers.get("content-type") || "";
      
      // Handle JSON files
      if (contentType.includes("application/json") || fileUrl.endsWith('.json')) {
        const jsonData = await response.json();
        const isArray = Array.isArray(jsonData);
        const rowCount = isArray ? jsonData.length : 1;
        const preview = JSON.stringify(jsonData, null, 2).slice(0, 2000);
        
        return `✅ **JSON File Parsed Successfully**

📊 **Summary:**
- Type: ${isArray ? 'Array' : 'Object'}
- Rows: ${rowCount}
${isArray && jsonData.length > 0 ? `- Columns: ${Object.keys(jsonData[0]).join(', ')}` : ''}

📄 **Preview (first 2000 chars):**
\`\`\`json
${preview}${preview.length >= 2000 ? '\n... (truncated)' : ''}
\`\`\`

💡 **Next Steps:** Use \`analyze_csv_data\` tool to get statistics and insights.`;
      }
      
      // Handle CSV files
      const textData = await response.text();
      const parsed = parseCSV(textData);
      
      if (parsed.error) {
        return `❌ CSV parsing error: ${parsed.error}`;
      }
      
      const rowCount = parsed.data.length;
      const columnCount = parsed.fields.length;
      const preview = textData.split('\n').slice(0, 20).join('\n');
      
      return `✅ **CSV File Parsed Successfully**

📊 **Summary:**
- Rows: ${rowCount}
- Columns: ${columnCount}
- Column Names: ${parsed.fields.join(', ')}

📄 **Preview (first 20 rows):**
\`\`\`csv
${preview}${rowCount > 20 ? '\n... (' + (rowCount - 20) + ' more rows)' : ''}
\`\`\`

💡 **Next Steps:** Use \`analyze_csv_data\` tool to get detailed statistics, correlations, and insights.`;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `❌ Error reading file: ${errorMessage}\n\nPlease try pasting the first 30 rows of your data directly in the chat.`;
    }
  },
});

// ============================================================================
// TOOL 2: ANALYZE CSV DATA (CORE ANALYSIS ENGINE)
// ============================================================================

const analyzeCsvDataTool = new DynamicStructuredTool({
  name: "analyze_csv_data",
  description: `📊 Core statistical analysis engine - Works with ANY CSV data source.

**TWO WAYS TO USE:**

**1️⃣ After file upload:**
- First call read_uploaded_file to get CSV data
- Then call this tool with the returned data

**2️⃣ With pasted CSV data (DIRECT USE):**
- User pastes CSV directly in message like:
  "ORDERNUMBER,SALES,MONTH_ID
   10107,2871,2
   10121,2765.9,5"
- Extract the CSV text from user message
- Call this tool directly (no need for read_uploaded_file!)

**What it calculates:**
- Descriptive statistics (mean, median, std, min, max, quartiles)
- Correlations between numeric columns
- Missing values, outliers detection
- Data types for each column

⚠️ COLUMN NAMES ARE CASE-SENSITIVE!
- CSV header: "SALES" → Use "SALES" not "sales"
- CSV header: "Month_ID" → Use "Month_ID" not "month_id"
- Always use EXACT column names from the data`,
  schema: z.object({
    csvData: z.string().describe("The raw CSV data as a string (including header row). Can come from read_uploaded_file OR directly from user message."),
    focusColumns: z.array(z.string()).optional().describe("Specific EXACT column names (case-sensitive!) to analyze. Leave empty to analyze all columns."),
  }),
  func: async ({ csvData, focusColumns }) => {
    console.log('[DataAnalyst] analyze_csv_data called, data length:', csvData?.length || 0, 'focus columns:', focusColumns);
    try {
      const parsed = parseCSV(csvData);
      
      if (parsed.error) {
        return `❌ CSV parsing error: ${parsed.error}`;
      }
      
      const { data, fields } = parsed;
      const rowCount = data.length;
      
      if (rowCount === 0) {
        return "❌ No data found in CSV.";
      }
      
      // Determine which columns to analyze
      const columnsToAnalyze = focusColumns && focusColumns.length > 0 
        ? focusColumns.filter(col => fields.includes(col))
        : fields;
      
      // Analyze each column
      const columnStats: Record<string, any> = {};
      const numericColumns: string[] = [];
      
      for (const column of columnsToAnalyze) {
        const values = data.map(row => row[column]);
        const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
        const missingCount = rowCount - nonNullValues.length;
        const missingPercent = ((missingCount / rowCount) * 100).toFixed(1);
        
        // Check if column is numeric
        const numericValues = nonNullValues.filter(isNumeric).map(Number);
        const isNumericColumn = numericValues.length > nonNullValues.length * 0.8; // 80% numeric threshold
        
        if (isNumericColumn && numericValues.length > 0) {
          numericColumns.push(column);
          const sorted = [...numericValues].sort((a, b) => a - b);
          
          columnStats[column] = {
            type: 'numeric',
            count: nonNullValues.length,
            missing: missingCount,
            missingPercent,
            mean: mean(numericValues).toFixed(2),
            median: median(numericValues).toFixed(2),
            std: standardDeviation(numericValues).toFixed(2),
            min: Math.min(...numericValues).toFixed(2),
            max: Math.max(...numericValues).toFixed(2),
            q25: median(sorted.slice(0, Math.floor(sorted.length / 2))).toFixed(2),
            q75: median(sorted.slice(Math.ceil(sorted.length / 2))).toFixed(2),
          };
        } else {
          // Categorical column
          const uniqueValues = new Set(nonNullValues);
          const valueCounts = nonNullValues.reduce((acc, val) => {
            acc.set(val, (acc.get(val) || 0) + 1);
            return acc;
          }, new Map<string, number>());
          
          const topValues = (Array.from(valueCounts.entries()) as Array<[string, number]>)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
          
          columnStats[column] = {
            type: 'categorical',
            count: nonNullValues.length,
            missing: missingCount,
            missingPercent,
            unique: uniqueValues.size,
            topValues: topValues.map(([val, count]) => `${val} (${count})`).join(', '),
          };
        }
      }
      
      // Calculate correlations for numeric columns
      const correlations: Array<{col1: string, col2: string, correlation: number}> = [];
      
      if (numericColumns.length >= 2) {
        for (let i = 0; i < numericColumns.length; i++) {
          for (let j = i + 1; j < numericColumns.length; j++) {
            const col1 = numericColumns[i];
            const col2 = numericColumns[j];
            
            const values1 = data.map(row => row[col1]).filter(isNumeric).map(Number);
            const values2 = data.map(row => row[col2]).filter(isNumeric).map(Number);
            
            // Ensure same length (remove rows where either value is missing)
            const paired: Array<[number, number]> = [];
            for (let k = 0; k < data.length; k++) {
              const v1 = data[k][col1];
              const v2 = data[k][col2];
              if (isNumeric(v1) && isNumeric(v2)) {
                paired.push([Number(v1), Number(v2)]);
              }
            }
            
            if (paired.length > 0) {
              const x = paired.map(p => p[0]);
              const y = paired.map(p => p[1]);
              const corr = correlation(x, y);
              
              if (Math.abs(corr) > 0.3) { // Only show significant correlations
                correlations.push({ col1, col2, correlation: corr });
              }
            }
          }
        }
      }
      
      // Format output
      let output = `📊 **Statistical Analysis Results**\n\n`;
      output += `**Dataset Overview:**\n`;
      output += `- Total Rows: ${rowCount}\n`;
      output += `- Total Columns: ${fields.length}\n`;
      output += `- Numeric Columns: ${numericColumns.length}\n`;
      output += `- Categorical Columns: ${columnsToAnalyze.length - numericColumns.length}\n\n`;
      
      output += `**Column Statistics:**\n\n`;
      
      for (const [column, stats] of Object.entries(columnStats)) {
        output += `**${column}** (${stats.type}):\n`;
        if (stats.type === 'numeric') {
          output += `  - Count: ${stats.count}, Missing: ${stats.missing} (${stats.missingPercent}%)\n`;
          output += `  - Mean: ${stats.mean}, Median: ${stats.median}, Std: ${stats.std}\n`;
          output += `  - Min: ${stats.min}, Max: ${stats.max}\n`;
          output += `  - Q25: ${stats.q25}, Q75: ${stats.q75}\n`;
        } else {
          output += `  - Count: ${stats.count}, Missing: ${stats.missing} (${stats.missingPercent}%)\n`;
          output += `  - Unique Values: ${stats.unique}\n`;
          output += `  - Top Values: ${stats.topValues}\n`;
        }
        output += `\n`;
      }
      
      if (correlations.length > 0) {
        output += `**📈 Correlations (|r| > 0.3):**\n\n`;
        correlations
          .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
          .forEach(({ col1, col2, correlation: corr }) => {
            const strength = Math.abs(corr) > 0.7 ? '🔥 Strong' : Math.abs(corr) > 0.5 ? '📊 Moderate' : '📉 Weak';
            const direction = corr > 0 ? 'positive' : 'negative';
            output += `  - **${col1}** ↔ **${col2}**: ${corr.toFixed(3)} (${strength} ${direction})\n`;
          });
      } else {
        output += `**Correlations:** No significant correlations found (|r| > 0.3)\n`;
      }
      
      return output;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `❌ Analysis error: ${errorMessage}`;
    }
  },
});

// ============================================================================
// TOOL 3: GENERATE INSIGHTS
// ============================================================================

const generateInsightsTool = new DynamicStructuredTool({
  name: "generate_insights",
  description: `Generate actionable insights and recommendations from analyzed data.
Identifies trends, anomalies, and patterns.
Use this after analyzing the data to provide business value.`,
  schema: z.object({
    csvData: z.string().describe("The CSV data to analyze"),
    context: z.string().optional().describe("Business context or specific questions to address"),
  }),
  func: async ({ csvData, context }) => {
    try {
      const parsed = parseCSV(csvData);
      
      if (parsed.error) {
        return `❌ CSV parsing error: ${parsed.error}`;
      }
      
      const { data, fields } = parsed;
      const insights: string[] = [];
      
      // Detect numeric columns
      const numericColumns: string[] = [];
      for (const field of fields) {
        const values = data.map(row => row[field]).filter(isNumeric).map(Number);
        if (values.length > data.length * 0.8) {
          numericColumns.push(field);
        }
      }
      
      // Missing data insights
      for (const field of fields) {
        const values = data.map(row => row[field]);
        const missing = values.filter(v => v === null || v === undefined || v === '').length;
        const missingPercent = (missing / data.length) * 100;
        
        if (missingPercent > 10) {
          insights.push(`⚠️ **${field}** has ${missingPercent.toFixed(1)}% missing values - consider imputation or removal`);
        }
      }
      
      // Outlier detection for numeric columns
      for (const column of numericColumns) {
        const values = data.map(row => row[column]).filter(isNumeric).map(Number);
        const q1 = median(values.slice(0, Math.floor(values.length / 2)));
        const q3 = median(values.slice(Math.ceil(values.length / 2)));
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        const outliers = values.filter(v => v < lowerBound || v > upperBound);
        
        if (outliers.length > 0) {
          insights.push(`📊 **${column}** has ${outliers.length} potential outliers (${((outliers.length / values.length) * 100).toFixed(1)}%)`);
        }
      }
      
      // Detect trends (if time-series data)
      const timeColumns = fields.filter(f => 
        f.toLowerCase().includes('date') || 
        f.toLowerCase().includes('time') || 
        f.toLowerCase().includes('year') ||
        f.toLowerCase().includes('month')
      );
      
      if (timeColumns.length > 0 && numericColumns.length > 0) {
        insights.push(`📈 Time-series data detected (${timeColumns[0]}) - consider trend analysis over time`);
      }
      
      // Categorical distribution
      for (const field of fields) {
        if (!numericColumns.includes(field)) {
          const values = data.map(row => row[field]).filter(v => v !== null && v !== undefined && v !== '');
          const unique = new Set(values);
          const dominantPercent = (Math.max(...Array.from(unique).map(u => 
            values.filter(v => v === u).length
          )) / values.length) * 100;
          
          if (dominantPercent > 80) {
            insights.push(`🎯 **${field}** is heavily skewed (${dominantPercent.toFixed(1)}% dominated by one value)`);
          }
        }
      }
      
      if (insights.length === 0) {
        insights.push("✅ Data quality looks good! No major issues detected.");
      }
      
      let output = `💡 **Data Insights & Recommendations**\n\n`;
      if (context) {
        output += `**Context:** ${context}\n\n`;
      }
      output += insights.map((insight, i) => `${i + 1}. ${insight}`).join('\n');
      
      return output;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `❌ Error generating insights: ${errorMessage}`;
    }
  },
});

// ============================================================================
// TOOL 4: GENERATE VISUALIZATION CODE
// ============================================================================

const generateVisualizationTool = new DynamicStructuredTool({
  name: "generate_visualization",
  description: `Generate Python code for data visualization using matplotlib and seaborn.
Creates production-ready code with proper styling and labels.
Use this when the user wants charts.`,
  schema: z.object({
    chartType: z.enum(["bar", "line", "scatter", "histogram", "pie", "heatmap", "box", "violin", "pairplot"]).describe("Type of chart to generate"),
    columns: z.array(z.string()).describe("Column names to visualize"),
    title: z.string().optional().describe("Chart title"),
    datasetName: z.string().optional().describe("Variable name for the dataset (default: 'df')"),
  }),
  func: async ({ chartType, columns, title, datasetName = 'df' }) => {
    try {
      const chartTitle = title || `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`;
      
      const codeTemplates: Record<string, string> = {
        bar: `import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

# Set style
sns.set_style("whitegrid")
plt.figure(figsize=(12, 6))

# Create bar chart
${datasetName}['${columns[0]}'].value_counts().head(10).plot(kind='bar', color='steelblue')
plt.title('${chartTitle}', fontsize=16, fontweight='bold')
plt.xlabel('${columns[0]}', fontsize=12)
plt.ylabel('Count', fontsize=12)
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
plt.show()`,

        line: `import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

# Set style
sns.set_style("whitegrid")
plt.figure(figsize=(12, 6))

# Create line chart
${datasetName}${columns.length > 1 ? `[['${columns.join("', '")}']]` : `['${columns[0]}']`}.plot(kind='line', marker='o')
plt.title('${chartTitle}', fontsize=16, fontweight='bold')
plt.xlabel('Index' if not columns[1] else '${columns[0]}', fontsize=12)
plt.ylabel('${columns[columns.length > 1 ? 1 : 0]}', fontsize=12)
plt.legend()
plt.tight_layout()
plt.show()`,

        scatter: `import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

# Set style
sns.set_style("whitegrid")
plt.figure(figsize=(10, 6))

# Create scatter plot
plt.scatter(${datasetName}['${columns[0]}'], ${datasetName}['${columns[1] || columns[0]}'], 
            alpha=0.6, s=50, color='steelblue', edgecolors='black', linewidth=0.5)
plt.title('${chartTitle}', fontsize=16, fontweight='bold')
plt.xlabel('${columns[0]}', fontsize=12)
plt.ylabel('${columns[1] || columns[0]}', fontsize=12)
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()`,

        histogram: `import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

# Set style
sns.set_style("whitegrid")
plt.figure(figsize=(10, 6))

# Create histogram
${datasetName}['${columns[0]}'].hist(bins=30, color='steelblue', edgecolor='black')
plt.title('${chartTitle}', fontsize=16, fontweight='bold')
plt.xlabel('${columns[0]}', fontsize=12)
plt.ylabel('Frequency', fontsize=12)
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()`,

        heatmap: `import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

# Set style
plt.figure(figsize=(12, 10))

# Calculate correlation matrix
correlation_matrix = ${datasetName}${columns.length > 0 ? `[['${columns.join("', '")}']]` : ''}.corr()

# Create heatmap
sns.heatmap(correlation_matrix, annot=True, fmt='.2f', cmap='coolwarm', 
            center=0, square=True, linewidths=1, cbar_kws={"shrink": 0.8})
plt.title('${chartTitle}', fontsize=16, fontweight='bold', pad=20)
plt.tight_layout()
plt.show()`,

        box: `import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

# Set style
sns.set_style("whitegrid")
plt.figure(figsize=(10, 6))

# Create box plot
sns.boxplot(data=${datasetName}${columns.length > 0 ? `[['${columns.join("', '")}']]` : ''}, palette='Set2')
plt.title('${chartTitle}', fontsize=16, fontweight='bold')
plt.ylabel('Value', fontsize=12)
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
plt.show()`,

        violin: `import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

# Set style
sns.set_style("whitegrid")
plt.figure(figsize=(10, 6))

# Create violin plot
sns.violinplot(data=${datasetName}${columns.length > 0 ? `[['${columns.join("', '")}']]` : ''}, palette='muted')
plt.title('${chartTitle}', fontsize=16, fontweight='bold')
plt.ylabel('Value', fontsize=12)
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
plt.show()`,

        pairplot: `import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

# Create pairplot (correlation plot for multiple variables)
sns.pairplot(${datasetName}${columns.length > 0 ? `[['${columns.join("', '")}']]` : ''}, 
             diag_kind='kde', plot_kws={'alpha': 0.6, 's': 50, 'edgecolor': 'black'},
             corner=True)
plt.suptitle('${chartTitle}', y=1.02, fontsize=16, fontweight='bold')
plt.tight_layout()
plt.show()`,

        pie: `import matplotlib.pyplot as plt
import pandas as pd

# Set style
plt.figure(figsize=(10, 8))

# Create pie chart
${datasetName}['${columns[0]}'].value_counts().head(10).plot(kind='pie', 
    autopct='%1.1f%%', startangle=90, colors=sns.color_palette('pastel'))
plt.title('${chartTitle}', fontsize=16, fontweight='bold')
plt.ylabel('')
plt.tight_layout()
plt.show()`,
      };

      const code = codeTemplates[chartType] || codeTemplates.bar;
      
      return `🎨 **Generated ${chartType.toUpperCase()} Chart Code**

\`\`\`python
${code}
\`\`\`

📝 **Usage Instructions:**
1. Ensure your data is loaded in a pandas DataFrame named \`${datasetName}\`
2. Required columns: ${columns.join(', ')}
3. Install dependencies: \`pip install matplotlib seaborn pandas\`

💡 **Customization Tips:**
- Adjust \`figsize=(width, height)\` for different dimensions
- Change color palette: 'viridis', 'plasma', 'Set1', 'Set2', etc.
- Add \`plt.savefig('chart.png', dpi=300, bbox_inches='tight')\` to save`;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `❌ Error generating visualization: ${errorMessage}`;
    }
  },
});

// ============================================================================
// PHASE 2: ADVANCED TOOLS WITH E2B PYTHON EXECUTION
// ============================================================================

/**
 * Tool 5: Execute Python Code with E2B
 * Runs Python code in a secure E2B sandbox and returns results
 */
const executePythonCodeTool = new DynamicStructuredTool({
  name: "execute_python_code",
  description: `🐍 Execute Python code in E2B sandbox to CREATE REAL CHARTS and run analysis.

**WHEN TO USE:**
- User wants ACTUAL visualization (not just code)
- Custom Python analysis needed
- Machine learning models
- Complex transformations

**WORKS WITH PASTED CSV:**
✅ Embed CSV data directly in Python code using StringIO:

\`\`\`python
import pandas as pd
from io import StringIO
import matplotlib.pyplot as plt

csv_data = """COLUMN1,COLUMN2
value1,value2
value3,value4"""

df = pd.read_csv(StringIO(csv_data))
plt.figure(figsize=(10,6))
df['COLUMN1'].hist()
plt.title('My Chart')
plt.savefig('output.png')
print("Chart created!")
\`\`\`

**IMPORTANT:** Charts created with plt.savefig() will be **AUTOMATICALLY DISPLAYED** as images in the UI.
**Pre-installed libraries:** pandas, numpy, matplotlib, seaborn, scikit-learn, scipy

**Returns:** stdout, stderr, and PNG charts that display in the UI`,

  schema: z.object({
    code: z.string().describe("Python code to execute. Use print() for text output, plt.savefig() for charts."),
    description: z.string().optional().describe("Brief description of what this code does"),
  }),

  func: async ({ code, description }, runManager) => {
    const secrets = (runManager as any)?.secrets;
    try {
      const apiKey = getE2BApiKey(secrets);
      
      if (!apiKey) {
        return `❌ **E2B API Key Required**

To enable Python execution, you need to add your E2B API key:
1. Get a free API key from: https://e2b.dev
2. Add to environment: E2B_API_KEY=your_key_here
3. Or add to agent runtime secrets

This tool will execute the following code once configured:
\`\`\`python
${code}
\`\`\``;
      }

      const result = await executePythonCode(code, apiKey);

      if (!result.success) {
        return `❌ **Execution Failed**

**Error:**
${result.error || 'Unknown error'}

**stderr:**
${result.stderr || 'No error output'}

**stdout:**
${result.stdout || 'No standard output'}`;
      }

      let response = `✅ **Execution Successful**\n\n`;
      
      if (description) {
        response += `**Task:** ${description}\n\n`;
      }

      if (result.stdout) {
        response += `**Output:**\n\`\`\`\n${result.stdout}\n\`\`\`\n\n`;
      }

      if (result.charts && result.charts.length > 0) {
        response += `**Generated ${result.charts.length} chart(s):**\n`;
        result.charts.forEach((chart, idx) => {
          response += `- Chart ${idx + 1}: ${chart.format.toUpperCase()}\n`;
        });
      }

      if (result.stderr) {
        response += `\n**Warnings/Info:**\n${result.stderr}`;
      }

      // If we have charts, return in __generatedImage format for UI display
      if (result.charts && result.charts.length > 0) {
        const mainChart = result.charts[0];
        const imageUrl = `data:image/${mainChart.format};base64,${mainChart.data}`;
        
        return JSON.stringify({
          __generatedImage: {
            imageUrl,
            prompt: description || "Data visualization",
            model: "E2B Python Sandbox",
            dimensions: { width: 800, height: 600 },
          },
          message: response,
        });
      }

      return response;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `❌ **Fatal Error:** ${errorMessage}`;
    }
  },
});

/**
 * Tool 6: Generate and Execute Chart
 * Creates a chart from data and returns the actual image
 */
const generateAndExecuteChartTool = new DynamicStructuredTool({
  name: "generate_and_execute_chart",
  description: `Generate and execute a chart/visualization, returning the actual image (base64 PNG).
This tool combines code generation + execution to produce real charts using Python & E2B.

⚠️ CRITICAL: Extract csvUrl from user's message!
User message format: [File: data.csv - URL: https://blob.vercel-storage.com/data-xyz.csv]
YOU MUST extract this URL and use it as csvUrl parameter.

⚠️ COLUMN NAMES: Use EXACT column names (case-sensitive!) from the CSV.
Always check actual column names first (use read_uploaded_file).
Example: If CSV has "SALES", use "SALES" not "sales"

Supported chart types:
- bar, line, scatter, histogram, box, violin, heatmap, pie, pairplot

Use this when users want to SEE the actual chart, not just the code.`,

  schema: z.object({
    csvUrl: z.string().describe("Vercel Blob URL from user message [File: ... - URL: <THIS_URL>]"),
    chartType: z.enum([
      "bar", "line", "scatter", "histogram", "box",
      "violin", "heatmap", "pie", "pairplot"
    ]).describe("Type of chart to generate"),
    columns: z.array(z.string()).describe("EXACT column names (case-sensitive!) from CSV. Check with read_uploaded_file first."),
    title: z.string().optional().describe("Chart title"),
  }),

  func: async ({ csvUrl, chartType, columns, title }, runManager) => {
    const secrets = (runManager as any)?.secrets;
    console.log('[DataAnalyst] generate_and_execute_chart called:', {
      csvUrl: csvUrl?.slice(0, 100) || 'EMPTY',
      chartType,
      columns,
      title
    });
    try {
      const apiKey = getE2BApiKey(secrets);
      
      if (!apiKey) {
        return `❌ E2B API key required. Please configure E2B_API_KEY in your environment.`;
      }

      // Fetch CSV data
      const response = await fetch(csvUrl);
      if (!response.ok) {
        return `❌ Failed to fetch CSV from URL: ${response.statusText}`;
      }
      const csvData = await response.text();

      // Create sandbox and upload file
      const sandbox = await createSandbox(apiKey);
      const filePath = await uploadCsvToSandbox(csvData, sandbox, "data.csv");

      // Generate chart code
      const chartTitle = title || `${chartType.toUpperCase()} Chart`;
      const colList = columns.join("', '");
      
      const chartCode = `import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
warnings.filterwarnings('ignore')

# Set style
sns.set_style('whitegrid')
plt.rcParams['figure.facecolor'] = 'white'

# Load data
df = pd.read_csv('${filePath}')

# Create chart
plt.figure(figsize=(12, 8))

${generateChartSpecificCode(chartType, columns, chartTitle)}

plt.tight_layout()
plt.show()
`;

      // Execute code
      const execution = await sandbox.runCode(chartCode);
      
      await sandbox.kill();

      // Check for charts
      if (execution.results && execution.results.length > 0) {
        const chartData = execution.results[0];
        
        if (chartData.png) {
          return `✅ **Chart Generated Successfully**

**Type:** ${chartType.toUpperCase()}
**Columns:** ${columns.join(', ')}
**Title:** ${chartTitle}

📊 Chart image (PNG, base64-encoded):
\`\`\`
${chartData.png.substring(0, 100)}... (${chartData.png.length} bytes total)
\`\`\`

ℹ️ The chart is ready to be displayed or saved.`;
        }
      }

      const stdout = execution.logs.stdout.join('\n');
      const stderr = execution.logs.stderr.join('\n');
      const error = execution.error;

      if (error) {
        return `❌ **Chart Generation Failed**

**Error:** ${error.value}

**Code executed:**
\`\`\`python
${chartCode}
\`\`\``;
      }

      return `⚠️ **Chart executed but no image was returned**

Stdout: ${stdout}
Stderr: ${stderr}`;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `❌ Error: ${errorMessage}`;
    }
  },
});

/**
 * Helper function to generate chart-specific code
 */
function generateChartSpecificCode(chartType: string, columns: string[], title: string): string {
  const [col1, col2, col3] = columns;
  
  const templates: Record<string, string> = {
    bar: `df['${col1}'].value_counts().head(15).plot(kind='bar', color='steelblue', edgecolor='black')
plt.title('${title}', fontsize=16, fontweight='bold')
plt.xlabel('${col1}', fontsize=12)
plt.ylabel('Count', fontsize=12)
plt.xticks(rotation=45, ha='right')
plt.grid(axis='y', alpha=0.3)`,

    line: col2 
      ? `df.plot(x='${col1}', y='${col2}', kind='line', marker='o', linewidth=2, markersize=6, color='steelblue')
plt.title('${title}', fontsize=16, fontweight='bold')
plt.xlabel('${col1}', fontsize=12)
plt.ylabel('${col2}', fontsize=12)
plt.grid(True, alpha=0.3)
plt.xticks(rotation=45, ha='right')`
      : `df['${col1}'].plot(kind='line', marker='o', linewidth=2, markersize=6, color='steelblue')
plt.title('${title}', fontsize=16, fontweight='bold')
plt.xlabel('Index', fontsize=12)
plt.ylabel('${col1}', fontsize=12)
plt.grid(True, alpha=0.3)`,

    scatter: col2
      ? `plt.scatter(df['${col1}'], df['${col2}'], alpha=0.6, s=100, c='steelblue', edgecolors='black', linewidth=0.5)
plt.title('${title}', fontsize=16, fontweight='bold')
plt.xlabel('${col1}', fontsize=12)
plt.ylabel('${col2}', fontsize=12)
plt.grid(True, alpha=0.3)`
      : `plt.scatter(range(len(df)), df['${col1}'], alpha=0.6, s=100, c='steelblue', edgecolors='black', linewidth=0.5)
plt.title('${title}', fontsize=16, fontweight='bold')
plt.xlabel('Index', fontsize=12)
plt.ylabel('${col1}', fontsize=12)
plt.grid(True, alpha=0.3)`,

    histogram: `df['${col1}'].hist(bins=30, color='steelblue', edgecolor='black', alpha=0.7)
plt.title('${title}', fontsize=16, fontweight='bold')
plt.xlabel('${col1}', fontsize=12)
plt.ylabel('Frequency', fontsize=12)
plt.grid(axis='y', alpha=0.3)`,

    box: `df[['${columns.join("', '")}']].boxplot()
plt.title('${title}', fontsize=16, fontweight='bold')
plt.ylabel('Value', fontsize=12)
plt.xticks(rotation=45, ha='right')
plt.grid(axis='y', alpha=0.3)`,

    violin: `import numpy as np
numeric_cols = ['${columns.join("', '")}']
data_to_plot = [df[col].dropna() for col in numeric_cols]
plt.violinplot(data_to_plot, showmeans=True, showmedians=True)
plt.title('${title}', fontsize=16, fontweight='bold')
plt.ylabel('Value', fontsize=12)
plt.xticks(range(1, len(numeric_cols) + 1), numeric_cols, rotation=45, ha='right')
plt.grid(axis='y', alpha=0.3)`,

    heatmap: `numeric_df = df[['${columns.join("', '")}']].select_dtypes(include=['number'])
corr = numeric_df.corr()
sns.heatmap(corr, annot=True, cmap='coolwarm', center=0, square=True, linewidths=1, cbar_kws={"shrink": 0.8})
plt.title('${title}', fontsize=16, fontweight='bold')`,

    pie: `df['${col1}'].value_counts().head(10).plot(kind='pie', autopct='%1.1f%%', startangle=90, colors=sns.color_palette('pastel'))
plt.title('${title}', fontsize=16, fontweight='bold')
plt.ylabel('')`,

    pairplot: `# Note: pairplot is handled differently via seaborn
numeric_cols = ['${columns.join("', '")}']
sns.pairplot(df[numeric_cols].dropna(), diag_kind='hist', plot_kws={'alpha': 0.6, 's': 80, 'edgecolor': 'k'}, height=2.5)
plt.suptitle('${title}', y=1.02, fontsize=16, fontweight='bold')`,
  };

  return templates[chartType] || templates.bar;
}

/**
 * Tool 7: Advanced Pandas Operations
 * Perform complex data transformations using pandas in E2B
 */
const transformDataTool = new DynamicStructuredTool({
  name: "transform_data",
  description: `Perform advanced data transformations using pandas in E2B sandbox.

Supported operations:
- Filter rows by conditions
- Group by columns and aggregate
- Pivot tables
- Merge/join datasets
- Create new calculated columns
- Handle missing values (fillna, dropna, interpolate)
- Sort and rank data

Returns: Transformed data summary and statistics.`,

  schema: z.object({
    csvUrl: z.string().describe("URL to the CSV file"),
    operation: z.enum([
      "filter", "groupby", "pivot", "sort", "fillna", "dropna", "new_column"
    ]).describe("Type of transformation"),
    parameters: z.record(z.string()).describe("Operation-specific parameters (JSON object)"),
  }),

  func: async ({ csvUrl, operation, parameters }, runManager) => {
    const secrets = (runManager as any)?.secrets;
    try {
      const apiKey = getE2BApiKey(secrets);
      
      if (!apiKey) {
        return `❌ E2B API key required for data transformations.`;
      }

      // Fetch CSV
      const response = await fetch(csvUrl);
      const csvData = await response.text();

      // Create sandbox
      const sandbox = await createSandbox(apiKey);
      const filePath = await uploadCsvToSandbox(csvData, sandbox, "data.csv");

      // Generate transformation code
      let transformCode = `import pandas as pd
import numpy as np

df = pd.read_csv('${filePath}')

print("Original shape:", df.shape)
print("\\nOriginal columns:", df.columns.tolist())
print("\\nFirst few rows:")
print(df.head())

# Perform transformation
`;

      switch (operation) {
        case "filter":
          transformCode += `
# Filter: ${parameters.condition || 'No condition specified'}
df_filtered = df.query('${parameters.condition}')
print("\\nFiltered shape:", df_filtered.shape)
print("\\nFiltered data:")
print(df_filtered.head(20))
`;
          break;

        case "groupby":
          transformCode += `
# Group by: ${parameters.groupby_column}
# Aggregate: ${parameters.agg_function || 'mean'}
grouped = df.groupby('${parameters.groupby_column}').agg('${parameters.agg_function || 'mean'}')
print("\\nGrouped data:")
print(grouped)
`;
          break;

        case "pivot":
          transformCode += `
# Pivot table
pivot = df.pivot_table(
    values='${parameters.values}',
    index='${parameters.index}',
    columns='${parameters.columns || parameters.index}',
    aggfunc='${parameters.aggfunc || 'mean'}'
)
print("\\nPivot table:")
print(pivot)
`;
          break;

        case "sort":
          transformCode += `
# Sort by: ${parameters.column}
df_sorted = df.sort_values('${parameters.column}', ascending=${parameters.ascending !== 'false'})
print("\\nSorted data (top 20):")
print(df_sorted.head(20))
`;
          break;

        case "fillna":
          transformCode += `
# Fill missing values
df_filled = df.fillna(${parameters.value || 0})
print("\\nMissing values before:", df.isnull().sum().sum())
print("Missing values after:", df_filled.isnull().sum().sum())
print("\\nFilled data:")
print(df_filled.head())
`;
          break;

        case "dropna":
          transformCode += `
# Drop missing values
df_clean = df.dropna()
print("\\nShape before:", df.shape)
print("Shape after:", df_clean.shape)
print("\\nClean data:")
print(df_clean.head())
`;
          break;

        case "new_column":
          transformCode += `
# Create new column: ${parameters.column_name}
# Formula: ${parameters.formula}
df['${parameters.column_name}'] = ${parameters.formula}
print("\\nNew columns:", df.columns.tolist())
print("\\nData with new column:")
print(df[['${parameters.column_name}']].head(20))
`;
          break;
      }

      // Execute
      const execution = await sandbox.runCode(transformCode);
      await sandbox.kill();

      const stdout = execution.logs.stdout.join('\n');
      const stderr = execution.logs.stderr.join('\n');

      if (execution.error) {
        return `❌ **Transformation Failed**

**Error:** ${execution.error.value}

**Code:**
\`\`\`python
${transformCode}
\`\`\``;
      }

      return `✅ **Data Transformation Complete**

**Operation:** ${operation}
**Parameters:** ${JSON.stringify(parameters, null, 2)}

**Results:**
\`\`\`
${stdout}
\`\`\`

${stderr ? `**Warnings:**\n${stderr}` : ''}`;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `❌ Error: ${errorMessage}`;
    }
  },
});

/**
 * Tool 8: Simple Machine Learning
 * Run basic ML models (linear regression, classification) via E2B
 */
const simpleMachineLearningTool = new DynamicStructuredTool({
  name: "simple_ml_model",
  description: `Train and evaluate simple machine learning models on your data.

Supported models:
- linear_regression: Predict continuous values
- logistic_regression: Binary classification
- decision_tree: Classification or regression tree
- random_forest: Ensemble method

Returns: Model performance metrics, feature importance, and predictions.`,

  schema: z.object({
    csvUrl: z.string().describe("URL to the CSV file"),
    modelType: z.enum([
      "linear_regression", "logistic_regression", "decision_tree", "random_forest"
    ]).describe("Type of ML model"),
    targetColumn: z.string().describe("Column to predict (target variable)"),
    featureColumns: z.array(z.string()).describe("Columns to use as features (predictors)"),
    testSize: z.number().optional().default(0.2).describe("Proportion of data for testing (0.0-1.0)"),
  }),

  func: async ({ csvUrl, modelType, targetColumn, featureColumns, testSize }, runManager) => {
    const secrets = (runManager as any)?.secrets;
    try {
      const apiKey = getE2BApiKey(secrets);
      
      if (!apiKey) {
        return `❌ E2B API key required for machine learning operations.`;
      }

      // Fetch data
      const response = await fetch(csvUrl);
      const csvData = await response.text();

      const sandbox = await createSandbox(apiKey);
      const filePath = await uploadCsvToSandbox(csvData, sandbox, "data.csv");

      const mlCode = `import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score, classification_report
import warnings
warnings.filterwarnings('ignore')

# Load data
df = pd.read_csv('${filePath}')

# Prepare features and target
X = df[${JSON.stringify(featureColumns)}]
y = df['${targetColumn}']

# Handle missing values
X = X.fillna(X.mean())
y = y.fillna(y.mean() if y.dtype in ['float64', 'int64'] else y.mode()[0])

# Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=${testSize}, random_state=42)

print(f"Training samples: {len(X_train)}")
print(f"Testing samples: {len(X_test)}")
print(f"Features: {list(X.columns)}")
print(f"Target: ${targetColumn}\\n")

# Train model
${generateMLModelCode(modelType)}

# Make predictions
y_pred = model.predict(X_test)

# Evaluate
${generateMLEvaluationCode(modelType)}

# Feature importance (if available)
if hasattr(model, 'feature_importances_'):
    importance = pd.DataFrame({
        'feature': X.columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    print("\\n📊 Feature Importance:")
    print(importance)
elif hasattr(model, 'coef_'):
    importance = pd.DataFrame({
        'feature': X.columns,
        'coefficient': model.coef_.flatten() if len(model.coef_.shape) > 1 else model.coef_
    }).sort_values('coefficient', ascending=False, key=abs)
    print("\\n📊 Feature Coefficients:")
    print(importance)

# Sample predictions
print("\\n🔮 Sample Predictions (first 10):")
results = pd.DataFrame({
    'Actual': y_test.values[:10],
    'Predicted': y_pred[:10]
})
print(results)
`;

      const execution = await sandbox.runCode(mlCode);
      await sandbox.kill();

      const stdout = execution.logs.stdout.join('\n');
      const stderr = execution.logs.stderr.join('\n');

      if (execution.error) {
        return `❌ **ML Model Training Failed**

**Error:** ${execution.error.value}

**Possible causes:**
- Target column may need encoding for classification
- Features contain non-numeric data
- Insufficient data for training

**Code attempted:**
\`\`\`python
${mlCode}
\`\`\``;
      }

      return `✅ **Machine Learning Model Trained**

**Model:** ${modelType}
**Target:** ${targetColumn}
**Features:** ${featureColumns.join(', ')}
**Test Size:** ${testSize * 100}%

**Results:**
\`\`\`
${stdout}
\`\`\`

${stderr ? `**Warnings:**\n${stderr}` : ''}

💡 **Interpretation Tips:**
- Higher R² (closer to 1.0) = better regression fit
- Higher accuracy (closer to 1.0) = better classification
- Feature importance shows which variables matter most`;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `❌ Error: ${errorMessage}`;
    }
  },
});

/**
 * Generate ML model training code
 */
function generateMLModelCode(modelType: string): string {
  const models: Record<string, string> = {
    linear_regression: `from sklearn.linear_model import LinearRegression
model = LinearRegression()
model.fit(X_train, y_train)
print("✅ Linear Regression model trained")`,

    logistic_regression: `from sklearn.linear_model import LogisticRegression
model = LogisticRegression(max_iter=1000, random_state=42)
model.fit(X_train, y_train)
print("✅ Logistic Regression model trained")`,

    decision_tree: `from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
# Auto-detect task type
if y.dtype == 'object' or y.nunique() < 20:
    model = DecisionTreeClassifier(random_state=42, max_depth=5)
else:
    model = DecisionTreeRegressor(random_state=42, max_depth=5)
model.fit(X_train, y_train)
print(f"✅ Decision Tree model trained (type: {type(model).__name__})")`,

    random_forest: `from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
# Auto-detect task type
if y.dtype == 'object' or y.nunique() < 20:
    model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=5)
else:
    model = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=5)
model.fit(X_train, y_train)
print(f"✅ Random Forest model trained (type: {type(model).__name__})")`,
  };

  return models[modelType] || models.linear_regression;
}

/**
 * Generate ML evaluation code
 */
function generateMLEvaluationCode(modelType: string): string {
  if (modelType === "linear_regression") {
    return `mse = mean_squared_error(y_test, y_pred)
rmse = np.sqrt(mse)
r2 = r2_score(y_test, y_pred)

print(f"\\n📈 Regression Metrics:")
print(f"  Mean Squared Error (MSE): {mse:.4f}")
print(f"  Root MSE (RMSE): {rmse:.4f}")
print(f"  R² Score: {r2:.4f}")`;
  }

  return `# Classification metrics
accuracy = accuracy_score(y_test, y_pred)
print(f"\\n🎯 Classification Metrics:")
print(f"  Accuracy: {accuracy:.4f}")
print("\\n📊 Detailed Report:")
print(classification_report(y_test, y_pred))`;
}

// ============================================================================
// EXPORT TOOLS
// ============================================================================

/**
 * DataAnalystAgent tools (Phase 1 + Phase 2)
 * Provides tools for CSV/JSON parsing, statistical analysis, visualization,
 * Python execution, advanced transformations, and machine learning.
 */
export function createDataAnalystAgentTools(runtimeSecrets?: Record<string, string>): DynamicStructuredTool[] {
  return [
    // Phase 1: Basic Analysis (No execution required)
    readUploadedFileTool,
    analyzeCsvDataTool,
    generateInsightsTool,
    generateVisualizationTool,
    
    // Phase 2: Advanced Analysis (E2B execution required)
    executePythonCodeTool,
    generateAndExecuteChartTool,
    transformDataTool,
    simpleMachineLearningTool,
  ];
}
