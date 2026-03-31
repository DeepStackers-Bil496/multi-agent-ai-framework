import { test, expect } from "vitest";
import {
  ensureHasRecipients,
  sanitizeHeaderValue,
  validateEmailList,
} from "@/lib/agents/googleWorkspaceAgent/validators/emailValidation";

test("validateEmailList rejects invalid addresses", () => {
  expect(() => validateEmailList(["invalid-email"], "to")).toThrow(
    /Invalid to address/
  );
});

test("sanitizeHeaderValue prevents header injection", () => {
  expect(() =>
    sanitizeHeaderValue("Hello\nBcc: bad@example.com", "subject")
  ).toThrow(/Invalid header value/);
});

test("ensureHasRecipients requires at least one recipient", () => {
  expect(() => ensureHasRecipients([], [], [])).toThrow(/required/);
});
