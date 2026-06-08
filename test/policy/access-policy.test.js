import assert from "node:assert/strict";
import { test } from "node:test";

import { AccessPolicy } from "../../src/policy/access-policy.js";

test("allows only configured Feishu open ids", () => {
  const policy = new AccessPolicy({
    allowedOpenIds: ["ou_allowed"],
    allowedWorkdirs: [],
  });

  assert.equal(policy.canUseOpenId("ou_allowed"), true);
  assert.equal(policy.canUseOpenId("ou_denied"), false);
  assert.equal(policy.canUseOpenId(null), false);
});

test("denies all open ids when no whitelist is configured", () => {
  const policy = new AccessPolicy({
    allowedOpenIds: [],
    allowedWorkdirs: [],
  });

  assert.equal(policy.canUseOpenId("ou_any"), false);
});

test("allows only configured workdirs", () => {
  const policy = new AccessPolicy({
    allowedOpenIds: [],
    allowedWorkdirs: ["F:\\development\\f-codex"],
  });

  assert.equal(policy.canUseWorkdir("F:\\development\\f-codex"), true);
  assert.equal(policy.canUseWorkdir("F:\\development\\IDSS"), false);
  assert.equal(policy.canUseWorkdir(null), false);
});

test("default workdir must also be allowed", () => {
  const policy = new AccessPolicy({
    allowedOpenIds: [],
    allowedWorkdirs: ["F:\\development\\f-codex"],
    defaultWorkdir: "F:\\development\\f-codex",
  });

  assert.equal(policy.defaultWorkdir(), "F:\\development\\f-codex");
});

test("rejects a default workdir outside the whitelist", () => {
  assert.throws(
    () =>
      new AccessPolicy({
        allowedOpenIds: [],
        allowedWorkdirs: ["F:\\development\\f-codex"],
        defaultWorkdir: "F:\\development\\IDSS",
      }),
    /FCA_DEFAULT_WORKDIR must be included in FCA_ALLOWED_WORKDIRS/,
  );
});
