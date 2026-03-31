import { z } from "zod";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(100000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.string().optional().nullable(), 
  name: z.string().max(300).optional().nullable(),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.enum([
    "main-agent",
    "github-agent",
    "codebase-agent",
    "frontend-agent",
    "huggingface-agent",
    "google-workspace-agent",
    "search-agent",
    "coding-agent",
    "data-analyst-agent",
    "vision-agent",
  ]),
  selectedVisibilityType: z.enum(["public", "private"]),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;