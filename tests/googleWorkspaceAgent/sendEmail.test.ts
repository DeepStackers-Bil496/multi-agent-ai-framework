import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createGmailSendEmailTool } from "../../lib/agents/googleWorkspaceAgent/services/gmail/gmailTools";

const originalDryRun = process.env.GOOGLE_WORKSPACE_DRY_RUN;

afterEach(() => {
    process.env.GOOGLE_WORKSPACE_DRY_RUN = originalDryRun;
});

test("gmail_send_email returns dry-run payload without calling Gmail", async () => {
    process.env.GOOGLE_WORKSPACE_DRY_RUN = "true";

    const tool = createGmailSendEmailTool();
    const rawResult = await tool.func({
        to: ["alice@example.com"],
        subject: "Hello",
        body: "Test body",
        confirm: true,
    });

    const result = JSON.parse(rawResult);

    assert.equal(result.status, "dry_run");
    assert.deepEqual(result.payload.to, ["alice@example.com"]);
    assert.equal(result.payload.subject, "Hello");
});
