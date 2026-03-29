import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = {
  saveDocument: vi.fn(),
};

const textDocumentHandler = {
  kind: "text",
  onCreateDocument: vi.fn(),
  onUpdateDocument: vi.fn(),
};

const codeDocumentHandler = {
  kind: "code",
  onCreateDocument: vi.fn(),
  onUpdateDocument: vi.fn(),
};

const sheetDocumentHandler = {
  kind: "sheet",
  onCreateDocument: vi.fn(),
  onUpdateDocument: vi.fn(),
};

vi.mock("@/lib/db/queries", () => ({
  saveDocument: (...args: unknown[]) => dbMocks.saveDocument(...args),
}));

vi.mock("@/artifacts/text/server", () => ({
  textDocumentHandler,
}));

vi.mock("@/artifacts/code/server", () => ({
  codeDocumentHandler,
}));

vi.mock("@/artifacts/sheet/server", () => ({
  sheetDocumentHandler,
}));

describe("artifact server contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.saveDocument.mockReset();
  });

  it("keeps artifactKinds aligned with the registered document handlers", async () => {
    const { artifactKinds, documentHandlersByArtifactKind } = await import(
      "@/lib/artifacts/server"
    );

    expect(artifactKinds).toEqual(["text", "code", "sheet"]);
    expect(documentHandlersByArtifactKind.map((handler) => handler.kind)).toEqual(
      artifactKinds
    );
  });

  it("createDocumentHandler persists newly created content when the session has a user id", async () => {
    const { createDocumentHandler } = await import("@/lib/artifacts/server");
    const handler = createDocumentHandler({
      kind: "text",
      onCreateDocument: vi
        .fn()
        .mockResolvedValue("Initial draft content"),
      onUpdateDocument: vi.fn(),
    });

    await handler.onCreateDocument({
      id: "doc-100",
      title: "Design Draft",
      dataStream: { write: vi.fn() } as never,
      session: { user: { id: "user-1" } } as never,
    });

    expect(dbMocks.saveDocument).toHaveBeenCalledWith({
      id: "doc-100",
      title: "Design Draft",
      content: "Initial draft content",
      kind: "text",
      userId: "user-1",
    });
  });

  it("createDocumentHandler skips persistence when there is no session user id", async () => {
    const { createDocumentHandler } = await import("@/lib/artifacts/server");
    const handler = createDocumentHandler({
      kind: "code",
      onCreateDocument: vi.fn().mockResolvedValue("const answer = 42;"),
      onUpdateDocument: vi.fn(),
    });

    await handler.onCreateDocument({
      id: "doc-101",
      title: "Snippet",
      dataStream: { write: vi.fn() } as never,
      session: {} as never,
    });

    expect(dbMocks.saveDocument).not.toHaveBeenCalled();
  });

  it("createDocumentHandler persists updated content using the existing document id and title", async () => {
    const { createDocumentHandler } = await import("@/lib/artifacts/server");
    const handler = createDocumentHandler({
      kind: "sheet",
      onCreateDocument: vi.fn(),
      onUpdateDocument: vi.fn().mockResolvedValue("name,score\nAda,100"),
    });

    await handler.onUpdateDocument({
      document: {
        id: "doc-200",
        title: "Leaderboard",
        kind: "sheet",
        content: "name,score\nAda,90",
      } as never,
      description: "Raise Ada's score to 100",
      dataStream: { write: vi.fn() } as never,
      session: { user: { id: "user-7" } } as never,
    });

    expect(dbMocks.saveDocument).toHaveBeenCalledWith({
      id: "doc-200",
      title: "Leaderboard",
      content: "name,score\nAda,100",
      kind: "sheet",
      userId: "user-7",
    });
  });
});
