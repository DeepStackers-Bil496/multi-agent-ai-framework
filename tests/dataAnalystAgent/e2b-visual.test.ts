/**
 * E2B Integration Test - Real Visualization
 * Tests if E2B can create actual PNG images
 */

// Load environment
import { config } from "dotenv";
config({ path: ".env.local" });

import { test } from "node:test";
import assert from "node:assert";

test("E2B - Create Histogram PNG", async () => {
  console.log("\n🎨 Testing E2B visualization...\n");
  
  // Import E2B helper
  const { executePythonCode } = await import("../../lib/agents/dataAnalystAgent/e2bHelper");
  
  const apiKey = process.env.E2B_API_KEY;
  
  if (!apiKey) {
    console.log("❌ E2B_API_KEY not found in .env.local");
    throw new Error("E2B_API_KEY required");
  }
  
  console.log("✅ E2B_API_KEY found");
  
  // Python code to create a histogram
  const code = `
import matplotlib.pyplot as plt
import pandas as pd
from io import StringIO

csv_data = """ORDERNUMBER,SALES
10107,2871
10121,2765.9
10134,3884.34
10145,3746.7
10159,4900"""

df = pd.read_csv(StringIO(csv_data))

plt.figure(figsize=(10, 6))
plt.hist(df['SALES'], bins=5, color='steelblue', edgecolor='black')
plt.title('Sales Distribution')
plt.xlabel('SALES')
plt.ylabel('Frequency')
plt.savefig('histogram.png', dpi=100, bbox_inches='tight')
print("✅ Histogram created successfully!")
print(f"Sales data points: {len(df)}")
print(f"Mean sales: {df['SALES'].mean():.2f}")
`;

  console.log("🐍 Executing Python code in E2B sandbox...\n");
  
  const result = await executePythonCode(code, apiKey);
  
  console.log("📊 Execution Result:");
  console.log("- Success:", result.success);
  console.log("- stdout:", result.stdout);
  console.log("- stderr:", result.stderr);
  console.log("- Error:", result.error || "None");
  console.log("- Charts:", result.charts?.length || 0);
  
  // Assertions
  assert.ok(result.success, "Python execution should succeed");
  assert.ok(result.stdout.includes("Histogram created"), "Should confirm chart creation");
  assert.ok(result.charts && result.charts.length > 0, "Should return chart images");
  assert.strictEqual(result.charts![0].format, "png", "Chart should be PNG format");
  assert.ok(result.charts![0].data.length > 0, "Chart data should not be empty");
  
  console.log("\n✅ E2B visualization test PASSED!");
  console.log(`📈 Generated ${result.charts!.length} chart(s)`);
  console.log(`📦 PNG data size: ${result.charts![0].data.length} characters\n`);
});
