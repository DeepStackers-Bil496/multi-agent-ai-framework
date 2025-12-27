import * as dotenv from "dotenv";
import * as path from "path";
import { AGENT_STARTED, AGENT_ENDED, AGENT_STREAM, AGENT_ERROR } from "@/lib/constants";

// Load environment variables from .env.local as early as possible
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { AgentChatMessage } from "@/lib/types";

async function testMainAgent() {
    // Dynamic import to ensure environment variables are loaded first
    const { mainAgent } = await import("../../lib/agents/mainAgent/mainAgent");
    const { AgentUserRole } = await import("@/lib/constants");

    console.log("--- Agent Inspection ---");
    console.log(mainAgent); // Custom inspect
    console.log("\n--- Agent JSON ---");
    console.log(JSON.stringify(mainAgent, null, 2)); // toJSON
    console.log("------------------------");

    console.log("--- Testing MainAgent ---");

    const messages: AgentChatMessage[] = [
        { role: AgentUserRole, content: "Hello! Who are you and what can you do?" }
    ];

    try {
        const response = await mainAgent.run(messages);

        if (!response.body) {
            throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        console.log("Streaming response:");

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(line => line.trim() !== "");

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.type === AGENT_STREAM) {
                        const content = data.payload.content;
                        if (typeof content === "string") {
                            process.stdout.write(content);
                        } else if (content && typeof content === "object" && content.kwargs && typeof content.kwargs.content === "string") {
                            process.stdout.write(content.kwargs.content);
                        }
                    } else if (data.type === AGENT_STARTED) {
                        console.log(`\n[Agent Start: ${data.payload.name}]`);
                    } else if (data.type === AGENT_ENDED) {
                        console.log(`\n[Agent End: ${data.payload.name}]`);
                    } else if (data.type === AGENT_ERROR) {
                        console.error(`\n[Error: ${data.payload.content}]`);
                    }
                } catch (e) {
                    // Not JSON or partial JSON, just print it
                    process.stdout.write(line);
                }
            }
        }
    } catch (error) {
        console.error("Test failed:", error);
    }
}

testMainAgent();
