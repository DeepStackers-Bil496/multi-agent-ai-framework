import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { InferenceClient } from "@huggingface/inference";
import { GoogleGenAI } from "@google/genai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { put } from "@vercel/blob";

// Analysis types for structured output
type AnalysisType = "general" | "ocr" | "objects" | "chart" | "ui" | "style";

// Helper to get API keys from runtime secrets or environment
function getHfToken(runtimeSecrets?: Record<string, string>): string {
    return runtimeSecrets?.HF_TOKEN || process.env.HF_TOKEN || "";
}

function getGeminiApiKey(runtimeSecrets?: Record<string, string>): string {
    return runtimeSecrets?.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
}

// =============================================================================
// IMAGE ANALYSIS TOOL
// Uses Google Gemini Vision for multimodal analysis
// =============================================================================

/**
 * Analyze an image using Google Gemini Vision model
 */
async function analyzeImageWithGemini(
    imageUrl: string,
    analysisType: AnalysisType,
    customPrompt: string | undefined,
    apiKey: string
): Promise<string> {
    const model = new ChatGoogleGenerativeAI({
        model: "gemini-2.0-flash",
        apiKey,
    });

    // Build analysis prompt based on type
    let prompt: string;
    switch (analysisType) {
        case "ocr":
            prompt = "Extract all visible text from this image. Provide the text exactly as it appears, preserving formatting where possible. If there's no text, say so.";
            break;
        case "objects":
            prompt = "Identify and list all objects visible in this image. For each object, provide: name, location in image (top-left, center, etc.), approximate size relative to image, and any notable attributes.";
            break;
        case "chart":
            prompt = "Analyze this chart or graph. Identify: 1) Chart type (bar, line, pie, etc.), 2) Title and labels, 3) Data trends and key values, 4) What the data represents, 5) Key insights or conclusions.";
            break;
        case "ui":
            prompt = "Analyze this UI/screenshot. Identify: 1) UI elements (buttons, inputs, menus, etc.), 2) Layout structure, 3) Color scheme and styling, 4) Interactive elements, 5) Any visible text or labels, 6) Potential usability observations.";
            break;
        case "style":
            prompt = "Analyze the visual style of this image. Describe: 1) Color palette (primary, secondary, accent colors), 2) Art style (realistic, minimalist, etc.), 3) Composition and layout, 4) Mood and atmosphere, 5) Notable design elements.";
            break;
        case "general":
        default:
            prompt = customPrompt || "Describe this image in detail. Include: main subject, setting/context, notable elements, colors, mood, and any text visible.";
    }

    // If custom prompt provided, append it
    if (customPrompt && analysisType !== "general") {
        prompt += `\n\nAdditional instructions: ${customPrompt}`;
    }

    try {
        // Fetch image and convert to base64
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type") || "image/jpeg";
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");

        // Create multimodal message with image
        const message = new HumanMessage({
            content: [
                {
                    type: "text",
                    text: prompt,
                },
                {
                    type: "image_url",
                    image_url: {
                        url: `data:${contentType};base64,${base64}`,
                    },
                },
            ],
        });

        const result = await model.invoke([message]);
        return typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    } catch (error) {
        throw new Error(`Image analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

/**
 * analyze_image - Examine images to extract information
 */
export function createAnalyzeImageTool(runtimeSecrets?: Record<string, string>): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "analyze_image",
        description: `Analyze an image to extract information. Supports multiple analysis types:
- general: Overall description of the image
- ocr: Extract text from image (screenshots, documents, signs)
- objects: Identify and locate objects in the image
- chart: Interpret charts, graphs, and data visualizations
- ui: Analyze UI screenshots for elements and layout
- style: Analyze visual style, colors, and design elements`,
        schema: z.object({
            imageUrl: z.string().url().describe("URL of the image to analyze"),
            analysisType: z.enum(["general", "ocr", "objects", "chart", "ui", "style"])
                .default("general")
                .describe("Type of analysis to perform"),
            customPrompt: z.string().optional().describe("Additional instructions or specific questions about the image"),
        }),
        func: async ({ imageUrl, analysisType, customPrompt }) => {
            try {
                const apiKey = getGeminiApiKey(runtimeSecrets);
                if (!apiKey) {
                    return "Error: GEMINI_API_KEY is not configured. Please add it in Settings > Capabilities or environment variables.";
                }

                const result = await analyzeImageWithGemini(
                    imageUrl,
                    analysisType as AnalysisType,
                    customPrompt,
                    apiKey
                );

                return `**Image Analysis (${analysisType}):**\n\n${result}`;
            } catch (error) {
                return `Error analyzing image: ${error instanceof Error ? error.message : "Unknown error"}`;
            }
        },
    });
}

// =============================================================================
// IMAGE GENERATION TOOL
// Uses Nano Banana (Gemini) as default, HuggingFace Inference as fallback
// =============================================================================

/**
 * Generate an image using Nano Banana (Gemini native image generation)
 */
async function generateImageWithGemini(
    prompt: string,
    model: string,
    aspectRatio: string,
    apiKey: string
): Promise<{ imageUrl: string; model: string }> {
    const ai = new GoogleGenAI({ apiKey });

    console.log(`[VisionAgent] Generating image with Nano Banana model: ${model}`);
    console.log(`[VisionAgent] Prompt: ${prompt}`);
    console.log(`[VisionAgent] Aspect Ratio: ${aspectRatio}`);

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseModalities: ["Image"],
            imageConfig: {
                aspectRatio,
            },
        },
    });

    // Extract image data from response
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts || parts.length === 0) {
        throw new Error("No image generated in response");
    }

    // Find part with inline image data
    let imageData: string | undefined;
    let mimeType = "image/png";

    for (const part of parts) {
        if (part.inlineData?.data) {
            imageData = part.inlineData.data;
            mimeType = part.inlineData.mimeType || "image/png";
            break;
        }
    }

    if (!imageData) {
        throw new Error("No image data found in response");
    }

    // Convert base64 to buffer and upload to Vercel Blob
    const buffer = Buffer.from(imageData, "base64");

    const filename = `generated-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const blobResult = await put(filename, buffer, {
        access: "public",
        contentType: mimeType,
    });

    console.log(`[VisionAgent] Image uploaded to Blob: ${blobResult.url}`);

    return {
        imageUrl: blobResult.url,
        model,
    };
}

/**
 * Generate an image using Hugging Face models (fallback)
 */
async function generateImageWithHF(
    prompt: string,
    model: string,
    negativePrompt: string | undefined,
    width: number,
    height: number,
    hfToken: string
): Promise<{ imageUrl: string; model: string }> {
    const client = new InferenceClient(hfToken);

    console.log(`[VisionAgent] Generating image with HuggingFace model: ${model}`);
    console.log(`[VisionAgent] Prompt: ${prompt}`);

    // Generate image as blob
    const imageBlob = await client.textToImage(
        {
            model,
            inputs: prompt,
            parameters: {
                negative_prompt: negativePrompt,
                width,
                height,
            },
        },
        { outputType: "blob" }
    );

    // Upload to Vercel Blob storage
    const filename = `generated-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const arrayBuffer = await imageBlob.arrayBuffer();

    const blobResult = await put(filename, arrayBuffer, {
        access: "public",
        contentType: "image/png",
    });

    console.log(`[VisionAgent] Image uploaded to Blob: ${blobResult.url}`);

    return {
        imageUrl: blobResult.url,
        model,
    };
}

// Model categories
const GEMINI_MODELS = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"] as const;
const HF_MODELS = ["black-forest-labs/FLUX.1-schnell", "stabilityai/stable-diffusion-xl-base-1.0"] as const;

/**
 * generate_image - Create images from text descriptions
 */
export function createGenerateImageTool(runtimeSecrets?: Record<string, string>): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "generate_image",
        description: `Generate high-quality images from text descriptions.

Available models (Nano Banana - default, recommended):
- gemini-2.5-flash-image: Fast, high-quality generation (default)
- gemini-3-pro-image-preview: Professional quality, 4K support, complex prompts

Fallback models (HuggingFace):
- black-forest-labs/FLUX.1-schnell: Fast diffusion model
- stabilityai/stable-diffusion-xl-base-1.0: Detailed images

Tips for good prompts:
- Be specific about subject, style, lighting, and composition
- Include artistic styles like "digital art", "oil painting", "photorealistic"
- Mention quality terms like "highly detailed", "8k", "professional"`,
        schema: z.object({
            prompt: z.string().min(1).max(1000).describe("Detailed text description of the image to generate"),
            model: z.enum([...GEMINI_MODELS, ...HF_MODELS])
                .default("gemini-2.5-flash-image")
                .describe("Model to use for generation"),
            aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
                .default("1:1")
                .describe("Aspect ratio for the image (Gemini models only)"),
            negativePrompt: z.string().optional().describe("Things to avoid in the image (HuggingFace models only)"),
            width: z.number().min(256).max(1024).default(512).describe("Image width in pixels (HuggingFace models only)"),
            height: z.number().min(256).max(1024).default(512).describe("Image height in pixels (HuggingFace models only)"),
        }),
        func: async ({ prompt, model, aspectRatio, negativePrompt, width, height }) => {
            try {
                const isGeminiModel = GEMINI_MODELS.includes(model as typeof GEMINI_MODELS[number]);

                if (isGeminiModel) {
                    // Use Nano Banana (Gemini)
                    const apiKey = getGeminiApiKey(runtimeSecrets);
                    if (!apiKey) {
                        return "Error: GEMINI_API_KEY is not configured. Please add it in Settings > Capabilities or environment variables.";
                    }

                    const result = await generateImageWithGemini(prompt, model, aspectRatio, apiKey);

                    return JSON.stringify({
                        __generatedImage: {
                            imageUrl: result.imageUrl,
                            prompt,
                            model: result.model,
                            aspectRatio,
                        },
                        message: `Generated image with Nano Banana: "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}"`,
                    });
                } else {
                    // Use HuggingFace (fallback)
                    const hfToken = getHfToken(runtimeSecrets);
                    if (!hfToken) {
                        return "Error: HF_TOKEN is not configured. Please add your Hugging Face token in Settings > Capabilities or environment variables.";
                    }

                    const result = await generateImageWithHF(prompt, model, negativePrompt, width, height, hfToken);

                    return JSON.stringify({
                        __generatedImage: {
                            imageUrl: result.imageUrl,
                            prompt,
                            model: result.model,
                            dimensions: { width, height },
                        },
                        message: `Generated image with HuggingFace: "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}"`,
                    });
                }
            } catch (error) {
                return `Error generating image: ${error instanceof Error ? error.message : "Unknown error"}`;
            }
        },
    });
}

// =============================================================================
// TOOL COLLECTION
// =============================================================================

/**
 * Create all Vision Agent tools
 * @param runtimeSecrets Optional runtime secrets from database
 */
export function createAllVisionAgentTools(runtimeSecrets?: Record<string, string>): DynamicStructuredTool[] {
    return [
        createAnalyzeImageTool(runtimeSecrets),
        createGenerateImageTool(runtimeSecrets),
    ];
}
