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

const mockUuidState = {
  value: "doc-123",
};

vi.mock("@/lib/artifacts/server", () => ({
  artifactKinds: ["text", "code", "sheet"],
  documentHandlersByArtifactKind: mockArtifactState.handlers,
}));

vi.mock("@/lib/utils", () => ({
  generateUUID: () => mockUuidState.value,
}));

type ExecutableCreateDocumentTool = {
  execute: (args: { title: string; kind: "text" | "code" | "sheet" }) => Promise<{
    id: string;
    title: string;
    kind: string;
    content: string;
  }>;
};

describe("createDocument tool contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArtifactState.handlers.length = 0;
    mockUuidState.value = "doc-123";
  });

  it("writes the artifact bootstrap stream parts, calls the matching handler, and returns document metadata", async () => {
    const writes: StreamEvent[] = [];
    const textHandler: MockHandler = {
      kind: "text",
      onCreateDocument: vi.fn(async ({ dataStream }) => {
        dataStream.write({
          type: "data-textDelta",
          data: "Generated draft body",
          transient: true,
        });
      }),
      onUpdateDocument: vi.fn(),
    };
    mockArtifactState.handlers.push(textHandler);

    const { createDocument } = await import("@/lib/ai/tools/create-document");
    const tool = createDocument({
      session: { user: { id: "user-1" } } as never,
      dataStream: {
        write: vi.fn((event: StreamEvent) => writes.push(event)),
      } as never,
    }) as unknown as ExecutableCreateDocumentTool;

    const result = await tool.execute({
      title: "Architecture Notes",
      kind: "text",
    });

    expect(textHandler.onCreateDocument).toHaveBeenCalledWith({
      id: "doc-123",
      title: "Architecture Notes",
      dataStream: expect.any(Object),
      session: expect.objectContaining({
        user: expect.objectContaining({ id: "user-1" }),
      }),
    });

    expect(writes.map((event) => event.type)).toEqual([
      "data-kind",
      "data-id",
      "data-title",
      "data-clear",
      "data-textDelta",
      "data-finish",
    ]);
    expect(writes[0]).toMatchObject({
      type: "data-kind",
      data: "text",
      transient: true,
    });
    expect(writes[1]).toMatchObject({
      type: "data-id",
      data: "doc-123",
      transient: true,
    });
    expect(writes[2]).toMatchObject({
      type: "data-title",
      data: "Architecture Notes",
      transient: true,
    });
    expect(result).toEqual({
      id: "doc-123",
      title: "Architecture Notes",
      kind: "text",
      content: "A document was created and is now visible to the user.",
    });
  });

  it("throws when no handler exists for the requested artifact kind and does not emit finish", async () => {
    const writes: StreamEvent[] = [];

    const { createDocument } = await import("@/lib/ai/tools/create-document");
    const tool = createDocument({
      session: { user: { id: "user-2" } } as never,
      dataStream: {
        write: vi.fn((event: StreamEvent) => writes.push(event)),
      } as never,
    }) as unknown as ExecutableCreateDocumentTool;

    await expect(
      tool.execute({
        title: "Unknown Artifact",
        kind: "code",
      })
    ).rejects.toThrow("No document handler found for kind: code");

    expect(writes.map((event) => event.type)).toEqual([
      "data-kind",
      "data-id",
      "data-title",
      "data-clear",
    ]);
  });
});
