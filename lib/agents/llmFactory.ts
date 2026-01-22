/**
 * LLM Provider Factory
 * Creates LLM instances based on provider configuration
 */

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatMistralAI } from "@langchain/mistralai";
import { LLMImplMetadata } from "../types";



/**
 * Factory function to create LLM based on LLMImplMetadata
 * @param config Agent implementation metadata
 * @returns BaseChatModel instance
 */
export function createLLM(config: LLMImplMetadata): BaseChatModel {
    const { provider, modelID, apiKey, baseURL } = config;

    console.log(`[LLMFactory] Creating ${provider} LLM with model: ${modelID}`);

    switch (provider) {
        case "google":
            if (!apiKey) throw new Error("Gemini requires GEMINI_API_KEY");
            return new ChatGoogleGenerativeAI({
                model: modelID,
                apiKey,
            });

        case "openai":
            // OpenAI works with vLLM too - just set baseURL
            return new ChatOpenAI({
                model: modelID,
                apiKey: apiKey || "EMPTY", // vLLM doesn't need key
                configuration: baseURL ? { baseURL } : undefined,
            });

        case "groq":
            if (!apiKey) throw new Error("Groq requires GROQ_API_KEY");
            return new ChatGroq({
                model: modelID,
                apiKey,
            });

        case "ollama":
            // Ollama local - no API key needed
            return new ChatOllama({
                model: modelID,
                baseUrl: baseURL || "http://localhost:11434",
            });

        case "ollama-cloud":
            // Ollama Cloud - requires API key
            if (!apiKey) throw new Error("Ollama Cloud requires an API key");
            return new ChatOllama({
                model: modelID,
                baseUrl: baseURL || "https://api.ollama.com",
                headers: { Authorization: `Bearer ${apiKey}` },
            });

        case "anthropic":
            if (!apiKey) throw new Error("Anthropic requires ANTHROPIC_API_KEY");
            return new ChatAnthropic({
                model: modelID,
                apiKey,
            });

        case "mistral":
            if (!apiKey) throw new Error("Mistral requires MISTRAL_API_KEY");
            return new ChatMistralAI({
                model: modelID,
                apiKey,
            });

        // Self-hosted servers (OpenAI-compatible APIs)
        case "lmstudio":
            // LM Studio exposes an OpenAI-compatible API
            return new ChatOpenAI({
                model: modelID,
                apiKey: "lm-studio", // LM Studio doesn't require a real key
                configuration: {
                    baseURL: baseURL || "http://localhost:1234/v1",
                },
            });

        case "localai":
            // LocalAI is a drop-in OpenAI replacement
            return new ChatOpenAI({
                model: modelID,
                apiKey: "localai", // LocalAI doesn't require a real key
                configuration: {
                    baseURL: baseURL || "http://localhost:8080/v1",
                },
            });

        case "llamacpp":
            // llama-cpp-python server with OpenAI-compatible API
            return new ChatOpenAI({
                model: modelID,
                apiKey: "llamacpp", // llama.cpp server doesn't require a real key
                configuration: {
                    baseURL: baseURL || "http://localhost:8000/v1",
                },
            });

        case "textgenwebui":
            // text-generation-webui with OpenAI-compatible API extension
            return new ChatOpenAI({
                model: modelID,
                apiKey: "textgenwebui", // text-gen-webui doesn't require a real key
                configuration: {
                    baseURL: baseURL || "http://localhost:5000/v1",
                },
            });

        default:
            throw new Error(`Unknown LLM provider: ${provider}`);
    }
}
