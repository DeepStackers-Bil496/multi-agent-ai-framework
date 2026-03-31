import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { isTestEnvironment } from "@/lib/constants";

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size should be less than 5MB",
    })
    .refine(
      (file) => {
        const allowedTypes = [
          "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
          "text/csv", "application/csv", "application/json",
          "application/pdf",
          "application/msword", // .doc
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
          "application/vnd.ms-excel", // .xls
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
          "application/vnd.ms-powerpoint", // .ppt
          "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
        ];

        return (
          allowedTypes.includes(file.type) || 
          file.type.startsWith("text/") || 
          file.type === "application/octet-stream" || 
          file.type === ""
        );
      },
      {
        message: "Unsupported file type uploaded. Please upload images, documents, data, or code files.",
      }
    ),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Get filename from formData since Blob doesn't have name property
    const filename = (formData.get("file") as File).name;
    const fileBuffer = await file.arrayBuffer();

    if (isTestEnvironment) {
      return NextResponse.json({
        url: `https://blob.mock.local/${encodeURIComponent(filename)}`,
        pathname: filename,
        contentType: file.type,
      });
    }

    try {
      console.log('[Upload] Uploading file:', filename, 'Size:', fileBuffer.byteLength, 'bytes');
      const data = await put(`${filename}`, fileBuffer, {
        access: "public",
      });
      console.log('[Upload] Success:', data);
      return NextResponse.json(data);
    } catch (error) {
      console.error('[Upload] Error:', error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
