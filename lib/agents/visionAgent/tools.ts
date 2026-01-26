import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { InferenceClient } from "@huggingface/inference";
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
// Uses Hugging Face Inference API for image generation
// =============================================================================

/**
 * Generate an image using Hugging Face models and upload to Vercel Blob
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

    console.log(`[VisionAgent] Generating image with model: ${model}`);
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

/**
 * generate_image - Create images from text descriptions
 */
export function createGenerateImageTool(runtimeSecrets?: Record<string, string>): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "generate_image",
        description: `Generate high-quality images from text descriptions using state-of-the-art diffusion models.
Available models:
- black-forest-labs/FLUX.1-schnell (default): Fast, high-quality generation
- stabilityai/stable-diffusion-xl-base-1.0: Stable Diffusion XL for detailed images
- runwayml/stable-diffusion-v1-5: Classic Stable Diffusion

Tips for good prompts:
- Be specific about subject, style, lighting, and composition
- Include artistic styles like "digital art", "oil painting", "photorealistic"
- Mention quality terms like "highly detailed", "8k", "professional"`,
        schema: z.object({
            prompt: z.string().min(1).max(1000).describe("Detailed text description of the image to generate"),
            model: z.enum([
                "black-forest-labs/FLUX.1-schnell",
                "stabilityai/stable-diffusion-xl-base-1.0",
                "runwayml/stable-diffusion-v1-5",
            ])
                .default("black-forest-labs/FLUX.1-schnell")
                .describe("Model to use for generation"),
            negativePrompt: z.string().optional().describe("Things to avoid in the image (e.g., 'blurry, low quality, text')"),
            width: z.number().min(256).max(1024).default(512).describe("Image width in pixels (256-1024)"),
            height: z.number().min(256).max(1024).default(512).describe("Image height in pixels (256-1024)"),
        }),
        func: async ({ prompt, model, negativePrompt, width, height }) => {
            try {
                const hfToken = getHfToken(runtimeSecrets);
                if (!hfToken) {
                    return "Error: HF_TOKEN is not configured. Please add your Hugging Face token in Settings > Capabilities or environment variables.";
                }

                const result = await generateImageWithHF(
                    prompt,
                    model,
                    negativePrompt,
                    width,
                    height,
                    hfToken
                );

                // Return JSON that will be parsed by the chat route
                // The __generatedImage key identifies this as image data
                return JSON.stringify({
                    __generatedImage: {
                        imageUrl: result.imageUrl,
                        prompt,
                        model: result.model,
                        dimensions: { width, height },
                    },
                    message: `Generated image: "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}"`,
                });
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
