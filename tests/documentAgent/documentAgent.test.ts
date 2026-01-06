import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    createConvertFormatTool,
    createExtractKeyPointsTool,
    createGenerateReportTool,
    createSearchDocumentsTool,
    createSummarizeDocumentTool,
} from "../../lib/agents/documentAgent/tools";

describe("DocumentAgent tools", () => {
    it("summarizes content", async () => {
        const tool = createSummarizeDocumentTool();
        const result = await tool.func({
            content: "First sentence. Second sentence. Third sentence.",
            maxSentences: 2,
        });

        assert.match(result, /Summary/);
        assert.match(result, /First sentence/);
        assert.match(result, /Second sentence/);
    });

    it("extracts key points", async () => {
        const tool = createExtractKeyPointsTool();
        const result = await tool.func({
            content: "Alpha point. Beta point. Gamma point.",
            maxPoints: 2,
        });

        assert.match(result, /Key points/);
        assert.match(result, /Alpha point/);
        assert.match(result, /Beta point/);
    });

    it("generates a report", async () => {
        const tool = createGenerateReportTool();
        const result = await tool.func({
            title: "Weekly Summary",
            sections: [
                { heading: "Highlights", body: "Shipped the release." },
                { heading: "Next Steps", body: "Plan Q2 roadmap." },
            ],
        });

        assert.match(result, /# Weekly Summary/);
        assert.match(result, /## Highlights/);
        assert.match(result, /## Next Steps/);
    });

    it("searches documents", async () => {
        const tool = createSearchDocumentsTool();
        const result = await tool.func({
            query: "launch",
            documents: [
                { id: "1", title: "Launch Plan", content: "Details for launch." },
                { id: "2", title: "Notes", content: "General notes." },
            ],
        });

        assert.match(result, /Matches for "launch"/);
        assert.match(result, /Launch Plan/);
    });

    it("converts markdown to plaintext", async () => {
        const tool = createConvertFormatTool();
        const result = await tool.func({
            content: "# Title\n- item one\n- item two",
            fromFormat: "markdown",
            toFormat: "plaintext",
        });

        assert.ok(!result.includes("#"));
        assert.match(result, /Title/);
        assert.match(result, /item one/);
    });
});
