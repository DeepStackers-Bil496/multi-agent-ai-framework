import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Create delegation tools for routing to sub-agents.
 * These tools don't execute anything - they signal the router where to go.
 */
export function createDelegationTools(): DynamicStructuredTool[] {
    return [
        // GitHub delegation tool
        new DynamicStructuredTool({
            name: "delegate_to_github",
            description: `Route the task to the GitHub Agent for processing.
Use this when the user asks about:
- GitHub repositories, commits, branches, tags, files
- Issues (list, create, update, comment)
- Pull requests (list, view, diff, reviews)
- Searching code or repositories
- Any GitHub API operation`,
            schema: z.object({
                task: z.string().describe("The task to delegate to the GitHub agent."),
            }),
            func: async ({ task }) => `Delegating to GitHub Agent: ${task}`,
        }),

        // Coding delegation tool
        new DynamicStructuredTool({
            name: "delegate_to_coding",
            description: `Route the task to the Coding Agent for code execution.
Use this when the user asks to:
- Execute or run Python, JavaScript, or shell code
- Write and test code snippets
- Perform file operations in a sandbox
- Debug or analyze code by running it
- Any task that requires actual code execution`,
            schema: z.object({
                task: z.string().describe("The coding task to delegate."),
            }),
            func: async ({ task }) => `Delegating to Coding Agent: ${task}`,
        }),

        // Web Scraper delegation tool
        new DynamicStructuredTool({
            name: "delegate_to_webscraper",
            description: `Route the task to the Web Scraper Agent for web content extraction.
Use this when the user asks to:
- Fetch or scrape content from a URL
- Extract text, links, or metadata from a webpage
- Get information from a website
- Analyze web page content`,
            schema: z.object({
                task: z.string().describe("The web scraping task to delegate."),
            }),
            func: async ({ task }) => `Delegating to Web Scraper Agent: ${task}`,
        }),
    ];
}
