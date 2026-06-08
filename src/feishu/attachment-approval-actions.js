import { renderTaskCard } from "./task-card-renderer.js";

export function buildAttachmentApprovalCardAction(pendingApproval, { chatId }) {
  if (!chatId) {
    throw new Error("chatId is required to send an attachment approval card");
  }

  const approval = pendingApproval?.approval;
  const card = renderTaskCard({
    taskId: pendingApproval?.requestId ?? pendingApproval?.approvalId ?? "attachment-approval",
    status: "waiting_approval",
    feishuChatId: chatId,
    summaryText: "",
    finalText: "",
    approval,
  });

  return {
    type: "send",
    receiveIdType: "chat_id",
    receiveId: chatId,
    messageType: "interactive",
    card,
  };
}
