import { AgentConfig } from "../agentConfig";
import { FiCode } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import { APILLMImplMetadata, AgentUserMetadata } from "../../types";

const codingAgentUserMetadata: AgentUserMetadata = {
    id: "coding-agent",
    name: "Coding Agent",
    short_description: "Secure code execution with E2B sandbox",
    long_description: "Execute Python, JavaScript, and shell commands in a secure sandbox environment.",
    icon: FiCode,
    suggestedActions: [
        "Write a Python function to calculate fibonacci",
        "Run a shell command to list files",
        "Execute some JavaScript code",
        "Analyze this code and explain what it does"
    ],
}

const codingAgentImplementationMetadata: APILLMImplMetadata = {
    type: API_MODEL_TYPE,
    modelID: "gemini-2.5-flash",
    systemInstruction: `You are a Coding Assistant powered by E2B secure sandbox. You help users write and execute code.

You have the following tools for code execution:

CODE EXECUTION:
- run_python: Execute Python code and return output
- run_javascript: Execute JavaScript/TypeScript code
- run_shell: Run shell commands

FILE OPERATIONS:
- write_file: Write content to a file in the sandbox
- read_file: Read file contents from the sandbox

GUIDELINES:
- Always explain what the code does before running it
- Show the output clearly after execution
- Handle errors gracefully and explain what went wrong
- For multi-step tasks, break them down and execute sequentially
- When asked to analyze code, provide clear explanations`,
    apiKey: process.env.GEMINI_API_KEY || ""
}

export const CodingAgentConfig: AgentConfig<APILLMImplMetadata> = {
    user_metadata: codingAgentUserMetadata,
    implementation_metadata: codingAgentImplementationMetadata,
}
