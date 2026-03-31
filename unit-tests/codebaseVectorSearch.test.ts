import { beforeEach, describe, expect, it, vi } from "vitest";

type VectorSearchModule = typeof import("@/lib/agents/codebaseAgent/vectorSearch");

function createSqlTag() {
  return (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => ({
    kind: "sql",
    strings: Array.from(strings),
    values,
  });
}

async function loadVectorSearchModule() {
  vi.resetModules();

  const select = vi.fn();
  const insert = vi.fn();
  const remove = vi.fn();
  const drizzle = vi.fn(() => ({
    select,
    insert,
    delete: remove,
  }));

  const cosineDistance = vi.fn((left: unknown, right: unknown) => ({
    kind: "cosineDistance",
    left,
    right,
  }));
  const asc = vi.fn((value: unknown) => ({
    kind: "asc",
    value,
  }));
  const eq = vi.fn((left: unknown, right: unknown) => ({
    kind: "eq",
    left,
    right,
  }));
  const and = vi.fn((...conditions: unknown[]) => ({
    kind: "and",
    conditions,
  }));
  const sql = createSqlTag();
  const getEmbedding = vi.fn().mockResolvedValue([0.25, 0.5, 0.75]);

  const codebaseEmbedding = {
    id: "id-column",
    filePath: "filePath-column",
    chunkType: "chunkType-column",
    chunkName: "chunkName-column",
    parentClass: "parentClass-column",
    content: "content-column",
    startLine: "startLine-column",
    endLine: "endLine-column",
    embedding: "embedding-column",
  };

  vi.doMock("drizzle-orm/neon-serverless", () => ({
    drizzle,
  }));
  vi.doMock("drizzle-orm", () => ({
    cosineDistance,
    sql,
    asc,
    eq,
    and,
  }));
  vi.doMock("@/lib/db/pool", () => ({
    default: {},
  }));
  vi.doMock("@/lib/db/schema", () => ({
    codebaseEmbedding,
  }));
  vi.doMock("@/lib/agents/codebaseAgent/embeddings", () => ({
    getEmbedding,
  }));

  const mod = (await import(
    "@/lib/agents/codebaseAgent/vectorSearch"
  )) as VectorSearchModule;

  return {
    mod,
    spies: {
      drizzle,
      select,
      insert,
      remove,
      cosineDistance,
      asc,
      eq,
      and,
      getEmbedding,
    },
    codebaseEmbedding,
  };
}

describe("Codebase vector search core", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("searches the codebase with the default limit and no filters", async () => {
    const { mod, spies } = await loadVectorSearchModule();
    const expectedResults = [
      {
        id: "row-1",
        filePath: "lib/example.ts",
        chunkType: "function",
        chunkName: "searchStuff",
        parentClass: null,
        content: "function searchStuff() {}",
        startLine: 10,
        endLine: 18,
        distance: 0.1,
      },
    ];
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(expectedResults),
    };
    spies.select.mockReturnValue(chain);

    const result = await mod.searchCodebase("where is search implemented");

    expect(spies.getEmbedding).toHaveBeenCalledWith(
      "where is search implemented"
    );
    expect(chain.where).toHaveBeenCalledWith(undefined);
    expect(chain.limit).toHaveBeenCalledWith(5);
    expect(result).toEqual(expectedResults);
  });

  it("applies file path and chunk type filters when searching", async () => {
    const { mod, spies, codebaseEmbedding } = await loadVectorSearchModule();
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    spies.select.mockReturnValue(chain);

    await mod.searchCodebase("auth function", {
      limit: 3,
      filePathPrefix: "lib/agents/",
      chunkType: "function",
    });

    expect(spies.eq).toHaveBeenCalledWith(
      codebaseEmbedding.chunkType,
      "function"
    );
    expect(spies.and).toHaveBeenCalledTimes(1);
    expect(chain.where).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "and" })
    );
    expect(chain.limit).toHaveBeenCalledWith(3);
  });

  it("gets embeddings for a single file path", async () => {
    const { mod, spies, codebaseEmbedding } = await loadVectorSearchModule();
    const rows = [{ id: "existing-1", filePath: "lib/a.ts" }];
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(rows),
    };
    spies.select.mockReturnValue(chain);

    const result = await mod.getEmbeddingsByFilePath("lib/a.ts");

    expect(spies.eq).toHaveBeenCalledWith(codebaseEmbedding.filePath, "lib/a.ts");
    expect(result).toEqual(rows);
  });

  it("deletes embeddings for a single file path", async () => {
    const { mod, spies, codebaseEmbedding } = await loadVectorSearchModule();
    const deletionResult = { rowCount: 2 };
    const chain = {
      where: vi.fn().mockResolvedValue(deletionResult),
    };
    spies.remove.mockReturnValue(chain);

    const result = await mod.deleteEmbeddingsByFilePath("lib/b.ts");

    expect(spies.remove).toHaveBeenCalledWith(codebaseEmbedding);
    expect(spies.eq).toHaveBeenCalledWith(codebaseEmbedding.filePath, "lib/b.ts");
    expect(result).toEqual(deletionResult);
  });

  it("maps insertEmbeddings payloads into the DB schema shape", async () => {
    const { mod, spies, codebaseEmbedding } = await loadVectorSearchModule();
    const values = vi.fn().mockResolvedValue({ inserted: 1 });
    spies.insert.mockReturnValue({ values });

    await mod.insertEmbeddings([
      {
        filePath: "lib/c.ts",
        chunkType: "function",
        chunkName: "runThing",
        parentClass: null,
        content: "export function runThing() {}",
        startLine: 1,
        endLine: 3,
        embedding: [0.4, 0.5, 0.6],
      },
    ]);

    expect(spies.insert).toHaveBeenCalledWith(codebaseEmbedding);
    expect(values).toHaveBeenCalledWith([
      {
        filePath: "lib/c.ts",
        chunkType: "function",
        chunkName: "runThing",
        parentClass: null,
        content: "export function runThing() {}",
        startLine: 1,
        endLine: 3,
        embedding: [0.4, 0.5, 0.6],
      },
    ]);
  });

  it("does not hit the database when insertEmbeddings is called with an empty array", async () => {
    const { mod, spies } = await loadVectorSearchModule();

    await mod.insertEmbeddings([]);

    expect(spies.insert).not.toHaveBeenCalled();
  });

  it("returns the stored embedding count", async () => {
    const { mod, spies } = await loadVectorSearchModule();
    const chain = {
      from: vi.fn().mockResolvedValue([{ count: 42 }]),
    };
    spies.select.mockReturnValue(chain);

    await expect(mod.getEmbeddingsCount()).resolves.toBe(42);
  });

  it("returns zero when the count query yields no rows", async () => {
    const { mod, spies } = await loadVectorSearchModule();
    const chain = {
      from: vi.fn().mockResolvedValue([]),
    };
    spies.select.mockReturnValue(chain);

    await expect(mod.getEmbeddingsCount()).resolves.toBe(0);
  });

  it("clears all embeddings without adding filters", async () => {
    const { mod, spies, codebaseEmbedding } = await loadVectorSearchModule();
    const deletionResult = { ok: true };
    spies.remove.mockResolvedValue(deletionResult);

    const result = await mod.clearAllEmbeddings();

    expect(spies.remove).toHaveBeenCalledWith(codebaseEmbedding);
    expect(result).toEqual(deletionResult);
  });
});
