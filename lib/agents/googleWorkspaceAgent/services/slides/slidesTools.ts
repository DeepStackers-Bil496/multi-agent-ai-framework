import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { googleApiRequest } from "../../auth/googleAuth";

// Slides Create Presentation Tool
export function createSlidesCreatePresentationTool() {
    return new DynamicStructuredTool({
        name: "slides_create_presentation",
        description: "Create a new Google Slides presentation.",
        schema: z.object({
            title: z.string().describe("Presentation title"),
        }),
        func: async ({ title }) => {
            try {
                const presentation = await googleApiRequest<{
                    presentationId: string;
                    title: string;
                    slides: Array<{ objectId: string }>;
                }>("slides", "/presentations", {
                    method: "POST",
                    body: JSON.stringify({ title }),
                });

                return JSON.stringify({
                    status: "success",
                    presentationId: presentation.presentationId,
                    title: presentation.title,
                    slideCount: presentation.slides?.length || 0,
                    url: `https://docs.google.com/presentation/d/${presentation.presentationId}/edit`,
                    message: `Presentation created: ${presentation.title}`,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to create presentation: ${message}` });
            }
        },
    });
}

// Slides Get Presentation Tool
export function createSlidesGetPresentationTool() {
    return new DynamicStructuredTool({
        name: "slides_get_presentation",
        description: "Get metadata and slide information from a Google Slides presentation.",
        schema: z.object({
            presentationId: z.string().describe("The presentation ID"),
        }),
        func: async ({ presentationId }) => {
            try {
                const presentation = await googleApiRequest<{
                    presentationId: string;
                    title: string;
                    locale: string;
                    pageSize: { width: { magnitude: number }; height: { magnitude: number } };
                    slides: Array<{
                        objectId: string;
                        pageElements?: Array<{
                            objectId: string;
                            shape?: {
                                shapeType: string;
                                text?: {
                                    textElements?: Array<{
                                        textRun?: { content: string };
                                    }>;
                                };
                            };
                        }>;
                    }>;
                }>("slides", `/presentations/${encodeURIComponent(presentationId)}`);

                // Extract text content from each slide
                const slidesData = presentation.slides?.map((slide, index) => {
                    const textContent: string[] = [];
                    if (slide.pageElements) {
                        for (const element of slide.pageElements) {
                            if (element.shape?.text?.textElements) {
                                for (const textElement of element.shape.text.textElements) {
                                    if (textElement.textRun?.content) {
                                        const text = textElement.textRun.content.trim();
                                        if (text) {
                                            textContent.push(text);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    return {
                        slideNumber: index + 1,
                        objectId: slide.objectId,
                        textContent: textContent.length > 0 ? textContent : undefined,
                    };
                });

                return JSON.stringify({
                    status: "success",
                    presentationId: presentation.presentationId,
                    title: presentation.title,
                    slideCount: presentation.slides?.length || 0,
                    url: `https://docs.google.com/presentation/d/${presentation.presentationId}/edit`,
                    slides: slidesData,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to get presentation: ${message}` });
            }
        },
    });
}

// Export all Slides tools
export function createAllSlidesTools(): DynamicStructuredTool[] {
    return [
        createSlidesCreatePresentationTool(),
        createSlidesGetPresentationTool(),
    ];
}
