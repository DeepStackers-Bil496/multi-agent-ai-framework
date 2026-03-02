import { test } from "node:test";
import assert from "node:assert/strict";
import {
    ensureHasRecipients,
    sanitizeHeaderValue,
    validateEmailList,
} from "../../lib/agents/googleWorkspaceAgent/validators/emailValidation";

test("validateEmailList rejects invalid addresses", () => {
    assert.throws(
        () => validateEmailList(["invalid-email"], "to"),
        /Invalid to address/,
    );
});

test("sanitizeHeaderValue prevents header injection", () => {
    assert.throws(
        () => sanitizeHeaderValue("Hello\nBcc: bad@example.com", "subject"),
        /Invalid header value/,
    );
});

test("ensureHasRecipients requires at least one recipient", () => {
    assert.throws(() => ensureHasRecipients([], [], []), /required/);
});
