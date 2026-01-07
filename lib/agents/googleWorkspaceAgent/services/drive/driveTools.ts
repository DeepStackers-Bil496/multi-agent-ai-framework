import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { googleApiRequest, getAccessToken, API_BASES } from "../../auth/googleAuth";

// Helper to format file info
function formatFileInfo(file: {
    id?: string;
    name?: string;
    mimeType?: string;
    size?: string;
    createdTime?: string;
    modifiedTime?: string;
    webViewLink?: string;
}) {
    return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size ? `${Math.round(parseInt(file.size) / 1024)} KB` : undefined,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
    };
}

// Drive List Files Tool
export function createDriveListFilesTool() {
    return new DynamicStructuredTool({
        name: "drive_list_files",
        description: "List files in Google Drive with optional filters.",
        schema: z.object({
            pageSize: z.number().int().min(1).max(100).optional().default(10).describe("Number of files to return"),
            orderBy: z
                .string()
                .optional()
                .default("modifiedTime desc")
                .describe("Sort order (e.g., 'modifiedTime desc', 'name')"),
            query: z
                .string()
                .optional()
                .describe("Drive query filter (e.g., \"mimeType='application/pdf'\", \"name contains 'report'\")"),
            folderId: z.string().optional().describe("Folder ID to list files from"),
        }),
        func: async ({ pageSize, orderBy, query, folderId }) => {
            try {
                const params = new URLSearchParams();
                params.set("pageSize", String(pageSize ?? 10));
                params.set("orderBy", orderBy ?? "modifiedTime desc");
                params.set("fields", "files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)");

                let q = query || "";
                if (folderId) {
                    q = q ? `${q} and '${folderId}' in parents` : `'${folderId}' in parents`;
                }
                if (q) {
                    params.set("q", q);
                }

                const response = await googleApiRequest<{ files?: any[] }>(
                    "drive",
                    `/files?${params.toString()}`
                );

                const files = response.files ?? [];
                if (files.length === 0) {
                    return JSON.stringify({
                        status: "success",
                        message: "No files found.",
                        count: 0,
                        files: [],
                    });
                }

                return JSON.stringify({
                    status: "success",
                    count: files.length,
                    files: files.map(formatFileInfo),
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to list files: ${message}` });
            }
        },
    });
}

// Drive Search Files Tool
export function createDriveSearchFilesTool() {
    return new DynamicStructuredTool({
        name: "drive_search_files",
        description:
            "Search files in Google Drive using Drive query syntax. " +
            "Examples: \"name contains 'report'\", \"mimeType='application/pdf'\", \"fullText contains 'budget'\"",
        schema: z.object({
            query: z.string().describe("Drive search query"),
            maxResults: z.number().int().min(1).max(100).optional().default(10).describe("Maximum files to return"),
            corpora: z
                .enum(["user", "allDrives", "domain"])
                .optional()
                .default("user")
                .describe("Search scope: user (My Drive), allDrives, domain"),
        }),
        func: async ({ query, maxResults, corpora }) => {
            try {
                const params = new URLSearchParams();
                params.set("q", query);
                params.set("pageSize", String(maxResults ?? 10));
                params.set("corpora", corpora ?? "user");
                params.set("fields", "files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)");

                if (corpora === "allDrives") {
                    params.set("includeItemsFromAllDrives", "true");
                    params.set("supportsAllDrives", "true");
                }

                const response = await googleApiRequest<{ files?: any[] }>(
                    "drive",
                    `/files?${params.toString()}`
                );

                const files = response.files ?? [];
                if (files.length === 0) {
                    return JSON.stringify({
                        status: "success",
                        message: "No files found matching the query.",
                        count: 0,
                        files: [],
                    });
                }

                return JSON.stringify({
                    status: "success",
                    count: files.length,
                    files: files.map(formatFileInfo),
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to search files: ${message}` });
            }
        },
    });
}

// Drive Get File Tool
export function createDriveGetFileTool() {
    return new DynamicStructuredTool({
        name: "drive_get_file",
        description: "Get metadata for a specific file by ID.",
        schema: z.object({
            fileId: z.string().describe("The file ID to retrieve"),
        }),
        func: async ({ fileId }) => {
            try {
                const params = new URLSearchParams();
                params.set(
                    "fields",
                    "id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,shared,owners"
                );

                const file = await googleApiRequest<any>(
                    "drive",
                    `/files/${encodeURIComponent(fileId)}?${params.toString()}`
                );

                return JSON.stringify({
                    status: "success",
                    file: {
                        ...formatFileInfo(file),
                        webContentLink: file.webContentLink,
                        parents: file.parents,
                        shared: file.shared,
                        owners: file.owners?.map((o: any) => o.emailAddress),
                    },
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to get file: ${message}` });
            }
        },
    });
}

// Drive Upload File Tool
export function createDriveUploadFileTool() {
    return new DynamicStructuredTool({
        name: "drive_upload_file",
        description: "Upload a file to Google Drive. Content should be base64 encoded.",
        schema: z.object({
            name: z.string().describe("File name"),
            mimeType: z.string().describe("MIME type (e.g., 'text/plain', 'application/pdf')"),
            content: z.string().describe("Base64 encoded file content"),
            folderId: z.string().optional().describe("Parent folder ID (optional)"),
        }),
        func: async ({ name, mimeType, content, folderId }) => {
            try {
                const token = await getAccessToken();

                // Create multipart upload
                const metadata: any = {
                    name,
                    mimeType,
                };
                if (folderId) {
                    metadata.parents = [folderId];
                }

                const boundary = "-------314159265358979323846";
                const delimiter = `\r\n--${boundary}\r\n`;
                const closeDelimiter = `\r\n--${boundary}--`;

                const fileContent = Buffer.from(content, "base64");

                const multipartBody =
                    delimiter +
                    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
                    JSON.stringify(metadata) +
                    delimiter +
                    `Content-Type: ${mimeType}\r\n` +
                    "Content-Transfer-Encoding: base64\r\n\r\n" +
                    content +
                    closeDelimiter;

                const response = await fetch(
                    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": `multipart/related; boundary=${boundary}`,
                        },
                        body: multipartBody,
                    }
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Upload failed: ${response.status} ${errorText}`);
                }

                const file = (await response.json()) as { id: string; name: string; webViewLink: string };

                return JSON.stringify({
                    status: "success",
                    message: `File uploaded: ${file.name}`,
                    fileId: file.id,
                    webViewLink: file.webViewLink,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to upload file: ${message}` });
            }
        },
    });
}

// Drive Download File Tool
export function createDriveDownloadFileTool() {
    return new DynamicStructuredTool({
        name: "drive_download_file",
        description:
            "Download a file's content from Google Drive. Returns base64 encoded content for binary files, or text for text files.",
        schema: z.object({
            fileId: z.string().describe("The file ID to download"),
        }),
        func: async ({ fileId }) => {
            try {
                const token = await getAccessToken();

                // First get file metadata to check type
                const metaResponse = await googleApiRequest<{ mimeType: string; name: string }>(
                    "drive",
                    `/files/${encodeURIComponent(fileId)}?fields=mimeType,name`
                );

                // Download the file
                const downloadResponse = await fetch(
                    `${API_BASES.drive}/files/${encodeURIComponent(fileId)}?alt=media`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                if (!downloadResponse.ok) {
                    const errorText = await downloadResponse.text();
                    throw new Error(`Download failed: ${downloadResponse.status} ${errorText}`);
                }

                const isTextType =
                    metaResponse.mimeType.startsWith("text/") ||
                    metaResponse.mimeType === "application/json" ||
                    metaResponse.mimeType === "application/xml";

                let content: string;
                if (isTextType) {
                    content = await downloadResponse.text();
                    return JSON.stringify({
                        status: "success",
                        fileName: metaResponse.name,
                        mimeType: metaResponse.mimeType,
                        encoding: "text",
                        content,
                    });
                } else {
                    const buffer = await downloadResponse.arrayBuffer();
                    content = Buffer.from(buffer).toString("base64");
                    return JSON.stringify({
                        status: "success",
                        fileName: metaResponse.name,
                        mimeType: metaResponse.mimeType,
                        encoding: "base64",
                        content,
                    });
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to download file: ${message}` });
            }
        },
    });
}

// Drive Delete File Tool
export function createDriveDeleteFileTool() {
    return new DynamicStructuredTool({
        name: "drive_delete_file",
        description: "Move a file to trash in Google Drive.",
        schema: z.object({
            fileId: z.string().describe("The file ID to move to trash"),
        }),
        func: async ({ fileId }) => {
            try {
                await googleApiRequest(
                    "drive",
                    `/files/${encodeURIComponent(fileId)}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({ trashed: true }),
                    }
                );

                return JSON.stringify({
                    status: "success",
                    message: `File ${fileId} moved to trash.`,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to delete file: ${message}` });
            }
        },
    });
}

// Drive Share File Tool
export function createDriveShareFileTool() {
    return new DynamicStructuredTool({
        name: "drive_share_file",
        description: "Share a file with specific users by granting permissions.",
        schema: z.object({
            fileId: z.string().describe("The file ID to share"),
            email: z.string().email().describe("Email address of the user to share with"),
            role: z
                .enum(["reader", "writer", "commenter"])
                .describe("Permission role: reader (view only), writer (edit), commenter (comment only)"),
            sendNotification: z
                .boolean()
                .optional()
                .default(true)
                .describe("Send email notification to the user"),
        }),
        func: async ({ fileId, email, role, sendNotification }) => {
            try {
                const params = new URLSearchParams();
                if (!sendNotification) {
                    params.set("sendNotificationEmail", "false");
                }

                await googleApiRequest(
                    "drive",
                    `/files/${encodeURIComponent(fileId)}/permissions?${params.toString()}`,
                    {
                        method: "POST",
                        body: JSON.stringify({
                            type: "user",
                            role,
                            emailAddress: email,
                        }),
                    }
                );

                return JSON.stringify({
                    status: "success",
                    message: `File shared with ${email} as ${role}.`,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to share file: ${message}` });
            }
        },
    });
}

// Export all Drive tools
export function createAllDriveTools(): DynamicStructuredTool[] {
    return [
        createDriveListFilesTool(),
        createDriveSearchFilesTool(),
        createDriveGetFileTool(),
        createDriveUploadFileTool(),
        createDriveDownloadFileTool(),
        createDriveDeleteFileTool(),
        createDriveShareFileTool(),
    ];
}
