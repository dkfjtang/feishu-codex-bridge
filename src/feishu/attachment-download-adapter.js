export function prepareAttachmentDownloadRequest(envelope, pendingApproval) {
  return {
    attachmentKind: pendingApproval?.approval?.attachmentKind ?? envelope?.attachmentKind ?? "unsupported",
    messageId: envelope?.messageId ?? null,
    chatId: envelope?.chatId ?? null,
    chatType: envelope?.chatType ?? null,
    approvalId: pendingApproval?.approvalId ?? null,
    requestId: pendingApproval?.requestId ?? null,
    itemId: pendingApproval?.itemId ?? null,
  };
}

export function createDisabledAttachmentDownloadAdapter() {
  return {
    getStatus() {
      return {
        status: "disabled",
      };
    },
    async downloadAttachment(request) {
      return {
        status: "disabled",
        reason: "Feishu attachment download adapter is not configured",
        attachmentKind: request?.attachmentKind ?? "unsupported",
        approvalId: request?.approvalId ?? null,
      };
    },
  };
}

export function createTransportAttachmentDownloadAdapter({ transport } = {}) {
  if (!transport || typeof transport.downloadAttachment !== "function") {
    return createDisabledAttachmentDownloadAdapter();
  }

  return {
    getStatus() {
      return {
        status: "configured",
      };
    },
    async downloadAttachment(request) {
      const result = await transport.downloadAttachment(request);
      return sanitizeAttachmentDownloadResult(result, request);
    },
  };
}

function sanitizeAttachmentDownloadResult(result, request) {
  if (!result || typeof result !== "object") {
    return {
      status: "failed",
      reason: "Feishu attachment download transport returned an invalid result",
      attachmentKind: request?.attachmentKind ?? "unsupported",
      approvalId: request?.approvalId ?? null,
    };
  }

  return {
    status: typeof result.status === "string" ? result.status : "unknown",
    reason: typeof result.reason === "string" ? result.reason : null,
    attachmentKind:
      typeof result.attachmentKind === "string"
        ? result.attachmentKind
        : request?.attachmentKind ?? "unsupported",
    approvalId:
      typeof result.approvalId === "string" ? result.approvalId : request?.approvalId ?? null,
  };
}
