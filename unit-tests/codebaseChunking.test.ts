import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chunkFile,
  chunkTypeScriptFile,
} from "@/lib/agents/codebaseAgent/chunking";

describe("Codebase chunking core", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts imports, functions, arrow functions, and interfaces from TypeScript source", () => {
    const source = `
import { AlphaDependency } from "./alpha/dependency";
import { BetaDependency } from "./beta/dependency";

export function greetUser(name: string): string {
  const suffix = " from the codebase agent test fixture";
  return "Hello " + name + suffix;
}

export const formatSummary = (value: string) => {
  return value.trim().toUpperCase() + " with extra detail for chunk sizing";
};

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
}
`.trim();

    const chunks = chunkTypeScriptFile("src/example.ts", source);

    expect(chunks.some((chunk) => chunk.chunkType === "import")).toBe(true);
    expect(
      chunks.some(
        (chunk) =>
          chunk.chunkType === "function" && chunk.chunkName === "greetUser"
      )
    ).toBe(true);
    expect(
      chunks.some(
        (chunk) =>
          chunk.chunkType === "function" &&
          chunk.chunkName === "formatSummary"
      )
    ).toBe(true);
    expect(
      chunks.some(
        (chunk) =>
          chunk.chunkType === "general" &&
          chunk.chunkName === "UserProfile"
      )
    ).toBe(true);
  });

  it("splits oversized classes into class overview and method chunks", () => {
    const repeatedBody = Array.from({ length: 160 }, (_, index) => {
      return `    values.push("entry-${index.toString().padStart(3, "0")}");`;
    }).join("\n");

    const source = `
export class BigService {
  private label = "big-service";

  firstMethod(): string {
    const values: string[] = [];
${repeatedBody}
    return values.join(",");
  }

  secondMethod(name: string): string {
    return "hello " + name + this.label;
  }
}
`.trim();

    const chunks = chunkTypeScriptFile("src/big-service.ts", source);
    const classChunk = chunks.find(
      (chunk) =>
        chunk.chunkType === "class" && chunk.chunkName === "BigService"
    );
    const methodChunks = chunks.filter(
      (chunk) =>
        chunk.chunkType === "method" && chunk.parentClass === "BigService"
    );

    expect(classChunk).toBeDefined();
    expect(classChunk?.content).toContain("class BigService");
    expect(classChunk?.content).toContain("firstMethod()");
    expect(classChunk?.content).toContain("secondMethod(name: string): string");
    expect(methodChunks.length).toBeGreaterThan(0);
    expect(
      methodChunks.some((chunk) => chunk.chunkName?.startsWith("firstMethod"))
    ).toBe(true);
  });

  it("falls back to general line-based chunking for non-TypeScript files", () => {
    const markdown = Array.from({ length: 12 }, (_, index) => {
      return `Line ${index + 1}: this markdown content exists to exercise the general chunking fallback path.`;
    }).join("\n");

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "chunking-test-"));
    const docsDir = path.join(tempRoot, "docs");
    const markdownPath = path.join(docsDir, "guide.md");

    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(markdownPath, markdown, "utf8");

    try {
      const chunks = chunkFile(markdownPath, tempRoot);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.chunkType).toBe("general");
      expect(chunks[0]?.chunkName).toBe("guide.md");
      expect(chunks[0]?.filePath.replaceAll("\\", "/")).toBe("docs/guide.md");
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
