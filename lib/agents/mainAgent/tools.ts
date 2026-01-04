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
        // Email delegation tool
        new DynamicStructuredTool({
            name: "delegate_to_email",
            description: `Route the task to the Email Agent for drafting or sending emails.
Use this when the user asks to:
- Draft an email (subject/body)
- Manage recipients (to/cc/bcc)
- Adjust tone or format of an email
- Send an email after confirmation`,
            schema: z.object({
                task: z.string().describe("The email-related task to delegate."),
            }),
            func: async ({ task }) => `Delegating to Email Agent: ${task}`,
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
        // Codebase delegation tool
        new DynamicStructuredTool({
            name: "delegate_to_codebase",
            description: `Route the task to the Codebase Agent for code analysis and retrieval.
Use this when the user asks about:
- Code snippets, functions, classes, or files
- Code structure, architecture, or design
- Code implementation details
- Code documentation or comments`,
            schema: z.object({
                task: z.string().describe("The code-related task to delegate."),
            }),
            func: async ({ task }) => `Delegating to Codebase Agent: ${task}`,
        }),
    ];
}
