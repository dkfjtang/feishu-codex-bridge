import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createDisabledAttachmentDownloadAdapter,
  createTransportAttachmentDownloadAdapter,
  prepareAttachmentDownloadRequest,
} from "../../src/feishu/attachment-download-adapter.js";
import {
  buildAttachmentPendingApproval,
  decideAttachmentInput,
} from "../../src/feishu/attachment-policy.js";

test("prepareAttachmentDownloadRequest builds sanitized adapter input", () => {
  const envelope = {
    messageId: "om_file_123456789",
    chatId: "oc_123",
    chatType: "p2p",
    attachmentKind: "file",
    fileKey: "file_secret",
    fileName: "secret.txt",
  };
  const pending = buildAttachmentPendingApproval(
    envelope,
    decideAttachmentInput(envelope, { enabled: true }),
  );

  const request = prepareAttachmentDownloadRequest(envelope, pending);

  assert.deepEqual(request, {
    attachmentKind: "file",
    messageId: "om_file_123456789",
    chatId: "oc_123",
    chatType: "p2p",
    approvalId: "attachment-om_file_",
    requestId: "attachment-request-om_file_",
    itemId: "attachment-item-om_file_",
  });
  assert.equal(JSON.stringify(request).includes("file_secret"), false);
  assert.equal(JSON.stringify(request).includes("secret.txt"), false);
});

test("disabled attachment download adapter never downloads content", async () => {
  const adapter = createDisabledAttachmentDownloadAdapter();

  assert.deepEqual(adapter.getStatus(), {
    status: "disabled",
  });

  const result = await adapter.downloadAttachment({
    attachmentKind: "image",
    approvalId: "attachment-om_image",
    fileKey: "image_secret",
    fileName: "secret.png",
  });

  assert.deepEqual(result, {
    status: "disabled",
    reason: "Feishu attachment download adapter is not configured",
    attachmentKind: "image",
    approvalId: "attachment-om_image",
  });
  assert.equal(JSON.stringify(result).includes("image_secret"), false);
  assert.equal(JSON.stringify(result).includes("secret.png"), false);
});

test("transport attachment download adapter falls back to disabled when transport is missing", async () => {
  const adapter = createTransportAttachmentDownloadAdapter({});

  assert.deepEqual(adapter.getStatus(), {
    status: "disabled",
  });
  assert.deepEqual(await adapter.downloadAttachment({ attachmentKind: "file" }), {
    status: "disabled",
    reason: "Feishu attachment download adapter is not configured",
    attachmentKind: "file",
    approvalId: null,
  });
});

test("transport attachment download adapter returns sanitized transport result", async () => {
  const calls = [];
  const adapter = createTransportAttachmentDownloadAdapter({
    transport: {
      downloadAttachment: async (request) => {
        calls.push(request);
        return {
          status: "downloaded",
          reason: "ready",
          attachmentKind: request.attachmentKind,
          approvalId: request.approvalId,
          fileKey: "should_not_escape",
          fileName: "secret.txt",
          path: "F:\\secret.txt",
        };
      },
    },
  });

  const request = {
    attachmentKind: "file",
    messageId: "om_file_123",
    approvalId: "attachment-om_file",
    fileKey: "should_not_escape",
  };
  const result = await adapter.downloadAttachment(request);

  assert.deepEqual(adapter.getStatus(), {
    status: "configured",
  });
  assert.deepEqual(calls, [request]);
  assert.deepEqual(result, {
    status: "downloaded",
    reason: "ready",
    attachmentKind: "file",
    approvalId: "attachment-om_file",
  });
  assert.equal(JSON.stringify(result).includes("should_not_escape"), false);
  assert.equal(JSON.stringify(result).includes("secret.txt"), false);
});
