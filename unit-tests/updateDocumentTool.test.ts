import { beforeEach, describe, expect, it, vi } from "vitest";

type StreamEvent = {
  type: string;
  data: unknown;
  transient?: boolean;
};

type MockHandler = {
  kind: string;
  onCreateDocument: ReturnType<typeof vi.fn>;
  onUpdateDocument: ReturnType<typeof vi.fn>;
};

const mockArtifactState = {
  handlers: [] as MockHandler[],
};

const dbMocks = {
  getDocumentById: vi.fn(),
};

vi.mock("@/lib/artifacts/server", () => ({
  documentHandlersByArtifactKind: mockArtifactState.handlers,
}));

vi.mock("@/lib/db/queries", () => ({
  getDocumentById: (...args: unknown[]) => dbMocks.getDocumentById(...args),
}));

type ExecutableUpdateDocumentTool = {
  execute: (args: { id: string; description: string }) => Promise<{
    id?: string;
    title?: string;
    kind?: string;
    content?: string;
    error?: string;
  }>;
};

describe("updateDocument tool contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArtifactState.handlers.length = 0;
    dbMocks.getDocumentById.mockReset();
  });

  it("returns an error object when the document does not exist", async () => {
    dbMocks.getDocumentById.mockResolvedValue(null);
    const writes: StreamEvent[] = [];

    const { updateDocument } = await import("@/lib/ai/tools/update-document");
    const tool = updateDocument({
      session: { user: { id: "user-1" } } as never,
      dataStream: {
        write: vi.fn((event: StreamEvent) => writes.push(event)),
      } as never,
    }) as unknown as ExecutableUpdateDocumentTool;

    const result = await tool.execute({
      id: "missing-doc",
      description: "Add more detail",
    });

    expect(result).toEqual({
      error: "Document not found",
    });
    expect(writes).toEqual([]);
  });

  it("writes clear and finish stream parts around the matching update handler", async () => {
    dbMocks.getDocumentById.mockResolvedValue({
      id: "doc-55",
      title: "Component Notes",
      kind: "code",
      content: "const value = 1;",
    });

    const writes: StreamEvent[] = [];
    const codeHandler: MockHandler = {
      kind: "code",
      onCreateDocument: vi.fn(),
      onUpdateDocument: vi.fn(async ({ dataStream }) => {
        dataStream.write({
          type: "data-codeDelta",
          data: "const value = 2;",
          transient: true,
        });
      }),
    };
    mockArtifactState.handlers.push(codeHandler);

    const { updateDocument } = await import("@/lib/ai/tools/update-document");
    const tool = updateDocument({
      session: { user: { id: "user-1" } } as never,
      dataStream: {
        write: vi.fn((event: StreamEvent) => writes.push(event)),
      } as never,
    }) as unknown as ExecutableUpdateDocumentTool;

    const result = await tool.execute({
      id: "doc-55",
      description: "Change the value to 2",
    });

    expect(dbMocks.getDocumentById).toHaveBeenCalledWith({ id: "doc-55" });
    expect(codeHandler.onUpdateDocument).toHaveBeenCalledWith({
      document: expect.objectContaining({
        id: "doc-55",
        title: "Component Notes",
        kind: "code",
      }),
      description: "Change the value to 2",
      dataStream: expect.any(Object),
      session: expect.objectContaining({
        user: expect.objectContaining({ id: "user-1" }),
      }),
    });
    expect(writes.map((event) => event.type)).toEqual([
      "data-clear",
      "data-codeDelta",
      "data-finish",
    ]);
    expect(result).toEqual({
      id: "doc-55",
      title: "Component Notes",
      kind: "code",
      content: "The document has been updated successfully.",
    });
  });

  it("throws when the document kind has no registered handler and does not emit finish", async () => {
    dbMocks.getDocumentById.mockResolvedValue({
      id: "doc-77",
      title: "Image Prompt",
      kind: "image",
      content: "prompt",
    });

    const writes: StreamEvent[] = [];

    const { updateDocument } = await import("@/lib/ai/tools/update-document");
    const tool = updateDocument({
      session: { user: { id: "user-1" } } as never,
      dataStream: {
        write: vi.fn((event: StreamEvent) => writes.push(event)),
      } as never,
    }) as unknown as ExecutableUpdateDocumentTool;

    await expect(
      tool.execute({
        id: "doc-77",
        description: "Update the image prompt",
      })
    ).rejects.toThrow("No document handler found for kind: image");

    expect(writes.map((event) => event.type)).toEqual(["data-clear"]);
  });
});
