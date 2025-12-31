import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { sendEmail } from "../../lib/agents/emailAgent/tools/sendEmail";

const originalDryRun = process.env.EMAIL_DRY_RUN;
const originalDefaultFrom = process.env.DEFAULT_FROM;

afterEach(() => {
    process.env.EMAIL_DRY_RUN = originalDryRun;
    process.env.DEFAULT_FROM = originalDefaultFrom;
});

test("sendEmail returns dry-run payload without SMTP", async () => {
    process.env.EMAIL_DRY_RUN = "true";
    process.env.DEFAULT_FROM = "sender@example.com";

    const result = await sendEmail({
        to: ["alice@example.com"],
        subject: "Hello",
        body: "Test body",
        confirm: true,
    });

    assert.equal(result.status, "dry_run");
    if (result.status === "dry_run") {
        assert.deepEqual(result.payload.to, ["alice@example.com"]);
        assert.equal(result.payload.subject, "Hello");
        assert.equal(result.payload.from, "sender@example.com");
    }
});
