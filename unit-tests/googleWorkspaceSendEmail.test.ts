import { afterEach, test, expect } from "vitest";
import { createGmailSendEmailTool } from "@/lib/agents/googleWorkspaceAgent/services/gmail/gmailTools";

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

  expect(result.status).toBe("dry_run");
  expect(result.payload.to).toEqual(["alice@example.com"]);
  expect(result.payload.subject).toBe("Hello");
});
