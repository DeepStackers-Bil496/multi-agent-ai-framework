/**
 * AST-aware Code Chunking Service
 * Uses TypeScript compiler API to extract meaningful code chunks
 */

import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

export type ChunkType = "function" | "class" | "method" | "import" | "general";

export interface CodeChunk {
    filePath: string;
    chunkType: ChunkType;
    chunkName: string | null;
    parentClass: string | null;
    content: string;
    startLine: number;
    endLine: number;
}

// Maximum characters per chunk (to stay within embedding limits)
const MAX_CHUNK_SIZE = 2000;
// Minimum meaningful chunk size
const MIN_CHUNK_SIZE = 50;

/**
 * Extract the source text for a node
 */
function getNodeText(node: ts.Node, sourceFile: ts.SourceFile): string {
    return sourceFile.text.slice(node.getStart(sourceFile), node.getEnd());
}

/**
 * Get line number from position (1-indexed)
 */
function getLineNumber(pos: number, sourceFile: ts.SourceFile): number {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
}

/**
 * Extract function name from a function-like declaration
 */
function getFunctionName(node: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction): string | null {
    if (ts.isFunctionDeclaration(node) && node.name) {
        return node.name.text;
    }
    return null;
}

/**
 * Process a class declaration and extract chunks for the class and its methods
 */
function processClass(
    node: ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string,
    chunks: CodeChunk[]
): void {
    const className = node.name?.text || "AnonymousClass";

    // Create a chunk for the class declaration (without method bodies)
    const classStart = getLineNumber(node.getStart(sourceFile), sourceFile);
    const classEnd = getLineNumber(node.getEnd(), sourceFile);

    // Get class signature (first few lines with fields and constructor signature)
    const classText = getNodeText(node, sourceFile);

    // If class is small enough, keep it as one chunk
    if (classText.length <= MAX_CHUNK_SIZE) {
        chunks.push({
            filePath,
            chunkType: "class",
            chunkName: className,
            parentClass: null,
            content: classText,
            startLine: classStart,
            endLine: classEnd,
        });
    } else {
        // Extract methods as separate chunks
        node.members.forEach(member => {
            if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) {
                const methodName = ts.isConstructorDeclaration(member)
                    ? "constructor"
                    : (member.name as ts.Identifier)?.text || "anonymous";

                const methodText = getNodeText(member, sourceFile);
                const methodStart = getLineNumber(member.getStart(sourceFile), sourceFile);
                const methodEnd = getLineNumber(member.getEnd(), sourceFile);

                // If method is too large, split it
                if (methodText.length > MAX_CHUNK_SIZE) {
                    const splitChunks = splitLargeContent(methodText, methodStart, filePath, "method", methodName, className);
                    chunks.push(...splitChunks);
                } else if (methodText.length >= MIN_CHUNK_SIZE) {
                    chunks.push({
                        filePath,
                        chunkType: "method",
                        chunkName: methodName,
                        parentClass: className,
                        content: methodText,
                        startLine: methodStart,
                        endLine: methodEnd,
                    });
                }
            }
        });

        // Also add a class overview chunk (just the class declaration without method bodies)
        const classOverview = createClassOverview(node, sourceFile);
        if (classOverview.length >= MIN_CHUNK_SIZE) {
            chunks.push({
                filePath,
                chunkType: "class",
                chunkName: className,
                parentClass: null,
                content: classOverview,
                startLine: classStart,
                endLine: classStart + classOverview.split("\n").length,
            });
        }
    }
}

/**
 * Create a class overview (declaration + property/method signatures only)
 */
function createClassOverview(node: ts.ClassDeclaration, sourceFile: ts.SourceFile): string {
    const className = node.name?.text || "AnonymousClass";
    let overview = `class ${className}`;

    // Add extends/implements if present
    if (node.heritageClauses) {
        const heritageText = node.heritageClauses.map(h => getNodeText(h, sourceFile)).join(" ");
        overview += ` ${heritageText}`;
    }

    overview += " {\n";

    // Add member signatures
    node.members.forEach(member => {
        if (ts.isPropertyDeclaration(member)) {
            overview += `  ${getNodeText(member, sourceFile)}\n`;
        } else if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) {
            const methodName = ts.isConstructorDeclaration(member)
                ? "constructor"
                : (member.name as ts.Identifier)?.text || "anonymous";

            // Extract just the signature
            const params = member.parameters.map(p => getNodeText(p, sourceFile)).join(", ");
            const returnType = member.type ? `: ${getNodeText(member.type, sourceFile)}` : "";
            overview += `  ${methodName}(${params})${returnType} { ... }\n`;
        }
    });

    overview += "}";
    return overview;
}

/**
 * Split large content into smaller chunks with some overlap
 */
function splitLargeContent(
    content: string,
    startLine: number,
    filePath: string,
    chunkType: ChunkType,
    chunkName: string | null,
    parentClass: string | null
): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split("\n");
    const overlap = 3; // Number of lines to overlap between chunks

    let currentStart = 0;
    let currentChunk: string[] = [];
    let currentSize = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (currentSize + line.length + 1 > MAX_CHUNK_SIZE && currentChunk.length > 0) {
            // Save current chunk
            chunks.push({
                filePath,
                chunkType,
                chunkName: chunkName ? `${chunkName} (part ${chunks.length + 1})` : null,
                parentClass,
                content: currentChunk.join("\n"),
                startLine: startLine + currentStart,
                endLine: startLine + currentStart + currentChunk.length - 1,
            });

            // Start new chunk with overlap
            currentStart = Math.max(0, i - overlap);
            currentChunk = lines.slice(currentStart, i + 1);
            currentSize = currentChunk.join("\n").length;
        } else {
            currentChunk.push(line);
            currentSize += line.length + 1;
        }
    }

    // Don't forget the last chunk
    if (currentChunk.length > 0 && currentSize >= MIN_CHUNK_SIZE) {
        chunks.push({
            filePath,
            chunkType,
            chunkName: chunks.length > 0 ? `${chunkName} (part ${chunks.length + 1})` : chunkName,
            parentClass,
            content: currentChunk.join("\n"),
            startLine: startLine + currentStart,
            endLine: startLine + currentStart + currentChunk.length - 1,
        });
    }

    return chunks;
}

/**
 * Chunk a TypeScript/JavaScript file using AST parsing
 */
export function chunkTypeScriptFile(filePath: string, fileContent: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    // Parse the file
    const sourceFile = ts.createSourceFile(
        filePath,
        fileContent,
        ts.ScriptTarget.Latest,
        true, // setParentNodes
        filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    // Collect imports as one chunk
    const imports: string[] = [];
    let importEndLine = 0;

    // Visit each top-level statement
    sourceFile.statements.forEach(statement => {
        // Collect imports
        if (ts.isImportDeclaration(statement)) {
            imports.push(getNodeText(statement, sourceFile));
            importEndLine = getLineNumber(statement.getEnd(), sourceFile);
            return;
        }

        // Handle function declarations
        if (ts.isFunctionDeclaration(statement)) {
            const funcName = getFunctionName(statement);
            const funcText = getNodeText(statement, sourceFile);
            const startLine = getLineNumber(statement.getStart(sourceFile), sourceFile);
            const endLine = getLineNumber(statement.getEnd(), sourceFile);

            if (funcText.length > MAX_CHUNK_SIZE) {
                chunks.push(...splitLargeContent(funcText, startLine, filePath, "function", funcName, null));
            } else if (funcText.length >= MIN_CHUNK_SIZE) {
                chunks.push({
                    filePath,
                    chunkType: "function",
                    chunkName: funcName,
                    parentClass: null,
                    content: funcText,
                    startLine,
                    endLine,
                });
            }
            return;
        }

        // Handle class declarations
        if (ts.isClassDeclaration(statement)) {
            processClass(statement, sourceFile, filePath, chunks);
            return;
        }

        // Handle exported variable declarations (including arrow functions)
        if (ts.isVariableStatement(statement)) {
            statement.declarationList.declarations.forEach(decl => {
                if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
                    const funcName = ts.isIdentifier(decl.name) ? decl.name.text : null;
                    const funcText = getNodeText(statement, sourceFile);
                    const startLine = getLineNumber(statement.getStart(sourceFile), sourceFile);
                    const endLine = getLineNumber(statement.getEnd(), sourceFile);

                    if (funcText.length > MAX_CHUNK_SIZE) {
                        chunks.push(...splitLargeContent(funcText, startLine, filePath, "function", funcName, null));
                    } else if (funcText.length >= MIN_CHUNK_SIZE) {
                        chunks.push({
                            filePath,
                            chunkType: "function",
                            chunkName: funcName,
                            parentClass: null,
                            content: funcText,
                            startLine,
                            endLine,
                        });
                    }
                }
            });
            return;
        }

        // Handle exports (export const, export default, etc.)
        if (ts.isExportAssignment(statement) || ts.isExportDeclaration(statement)) {
            const exportText = getNodeText(statement, sourceFile);
            if (exportText.length >= MIN_CHUNK_SIZE) {
                chunks.push({
                    filePath,
                    chunkType: "general",
                    chunkName: "export",
                    parentClass: null,
                    content: exportText,
                    startLine: getLineNumber(statement.getStart(sourceFile), sourceFile),
                    endLine: getLineNumber(statement.getEnd(), sourceFile),
                });
            }
            return;
        }

        // Handle type declarations and interfaces
        if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
            const typeName = statement.name.text;
            const typeText = getNodeText(statement, sourceFile);
            if (typeText.length >= MIN_CHUNK_SIZE) {
                chunks.push({
                    filePath,
                    chunkType: "general",
                    chunkName: typeName,
                    parentClass: null,
                    content: typeText,
                    startLine: getLineNumber(statement.getStart(sourceFile), sourceFile),
                    endLine: getLineNumber(statement.getEnd(), sourceFile),
                });
            }
        }
    });

    // Add imports as a single chunk if there are any
    if (imports.length > 0) {
        const importContent = imports.join("\n");
        if (importContent.length >= MIN_CHUNK_SIZE) {
            chunks.push({
                filePath,
                chunkType: "import",
                chunkName: null,
                parentClass: null,
                content: importContent,
                startLine: 1,
                endLine: importEndLine,
            });
        }
    }

    return chunks;
}

/**
 * Read and chunk a file
 */
export function chunkFile(absolutePath: string, projectRoot: string): CodeChunk[] {
    const content = fs.readFileSync(absolutePath, "utf-8");
    const relativePath = path.relative(projectRoot, absolutePath);

    // Use TypeScript chunking for TS/TSX/JS/JSX files
    if (/\.(ts|tsx|js|jsx)$/.test(absolutePath)) {
        return chunkTypeScriptFile(relativePath, content);
    }

    // For other files, use simple line-based chunking
    return splitLargeContent(content, 1, relativePath, "general", path.basename(absolutePath), null);
}
