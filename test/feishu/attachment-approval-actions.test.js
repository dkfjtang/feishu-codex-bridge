import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAttachmentApprovalCardAction } from "../../src/feishu/attachment-approval-actions.js";
import { buildAttachmentPendingApproval } from "../../src/feishu/attachment-policy.js";

test("buildAttachmentApprovalCardAction builds sanitized send action", () => {
  const pending = buildAttachmentPendingApproval(
    {
      messageId: "om_file_123456789",
      chatId: "oc_123",
      chatType: "p2p",
      attachmentKind: "file",
      fileKey: "file_secret",
      fileName: "secret.txt",
    },
    { attachmentKind: "file" },
  );

  const action = buildAttachmentApprovalCardAction(pending, { chatId: "oc_123" });

  assert.equal(action.type, "send");
  assert.equal(action.receiveIdType, "chat_id");
  assert.equal(action.receiveId, "oc_123");
  assert.equal(action.messageType, "interactive");
  assert.equal(action.card.header.title.content, "需要确认");
  assert.match(
    action.card.elements[0].text.content,
    /Codex 请求读取飞书附件，需要先完成确认和审计。/,
  );
  assert.deepEqual(
    action.card.elements[1].actions.map((button) => button.value.fcaAction),
    ["approval.details", "approval.resolve", "approval.resolve"],
  );
  assert.deepEqual(
    action.card.elements[1].actions.slice(1).map((button) => button.value.decision),
    ["decline", "cancel"],
  );
  assert.equal(action.card.elements[1].actions[0].value.requestId, "attachment-request-om_file_");
  assert.equal(action.card.elements[1].actions[0].value.approvalId, "attachment-om_file_");
  assert.equal(action.card.elements[1].actions[0].value.itemId, "attachment-item-om_file_");
  assert.equal(JSON.stringify(action).includes("acceptForSession"), false);
  assert.equal(JSON.stringify(action).includes("file_secret"), false);
  assert.equal(JSON.stringify(action).includes("secret.txt"), false);
  assert.equal(JSON.stringify(action).includes("om_file_123456789"), false);
});

test("buildAttachmentApprovalCardAction requires chat id", () => {
  assert.throws(
    () => buildAttachmentApprovalCardAction({ approval: {} }, {}),
    /chatId is required/,
  );
});
