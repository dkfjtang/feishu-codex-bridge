const BODY_LIMIT = 1000;
const FOOTER_FIELD_LIMIT = 120;
const DEFAULT_FOOTER_FIELDS = [
  "status",
  "thread",
  "turn",
  "elapsed",
  "tokens",
  "model",
  "version",
  "error",
  "cwd",
];

const STATUS_META = {
  queued: { title: "任务已接收", template: "blue" },
  running: { title: "Codex 执行中", template: "wathet" },
  waiting_approval: { title: "需要确认", template: "orange" },
  completed: { title: "已完成", template: "green" },
  failed: { title: "执行失败", template: "red" },
  cancelled: { title: "已取消", template: "grey" },
};

export function renderTaskCard(snapshot, { footerFields = DEFAULT_FOOTER_FIELDS } = {}) {
  const meta = STATUS_META[snapshot.status] ?? STATUS_META.running;

  return {
    config: {
      update_multi: true,
    },
    header: {
      template: meta.template,
      title: {
        tag: "plain_text",
        content: meta.title,
      },
    },
    elements: [
      {
        tag: "markdown",
        text: {
          tag: "lark_md",
          content: cardBody(snapshot),
        },
      },
      ...approvalActionElements(snapshot),
      {
        tag: "hr",
      },
      {
        tag: "note",
        elements: [
          {
            tag: "lark_md",
            content: footerText(snapshot, footerFields),
          },
        ],
      },
    ],
  };
}

function approvalActionElements(snapshot) {
  if (snapshot.status !== "waiting_approval" || snapshot.approval?.status !== "pending") {
    return [];
  }

  const value = {
    fcaAction: "approval.resolve",
    taskId: snapshot.taskId,
    requestId: snapshot.approval.requestId,
    approvalId: snapshot.approval.approvalId,
    itemId: snapshot.approval.itemId,
    chatId: snapshot.feishuChatId,
  };

  return [
    {
      tag: "action",
      actions: [
        approvalButton("查看详情", "default", { ...value, fcaAction: "approval.details" }),
        approvalButton("允许一次", "primary", { ...value, decision: "accept" }),
        approvalButton("本会话允许", "default", { ...value, decision: "acceptForSession" }),
        approvalButton("拒绝", "danger", { ...value, decision: "decline" }),
        approvalButton("停止", "default", { ...value, decision: "cancel" }),
      ],
    },
  ];
}

function approvalButton(content, type, value) {
  return {
    tag: "button",
    text: {
      tag: "plain_text",
      content,
    },
    type,
    value,
  };
}

function cardBody(snapshot) {
  if (snapshot.status === "failed") {
    return truncate(snapshot.errorSummary || "Codex turn failed", BODY_LIMIT);
  }

  if (snapshot.status === "waiting_approval") {
    return truncate(approvalBody(snapshot), BODY_LIMIT);
  }

  if (snapshot.status === "completed") {
    return truncate(joinBody([stageText(snapshot, "最近阶段"), snapshot.finalText || snapshot.summaryText]), BODY_LIMIT);
  }

  return truncate(joinBody([stageText(snapshot), snapshot.summaryText]), BODY_LIMIT);
}

function approvalBody(snapshot) {
  const expanded = snapshot.approval?.detailExpanded === true;
  return joinBody([
    expanded ? "审批详情" : null,
    snapshot.approval?.summary ?? "Codex 请求审批。",
    approvalDetails(snapshot.approval, expanded),
    expanded ? "仅展示脱敏摘要，未展示命令正文、diff、完整路径或原始 payload。" : null,
    snapshot.approval?.approvalId ? `approval: ${shortId(String(snapshot.approval.approvalId))}` : null,
  ]);
}

function approvalDetails(approval, expanded = false) {
  if (!Array.isArray(approval?.details) || approval.details.length === 0) {
    return null;
  }

  return approval.details.slice(0, expanded ? 10 : 6).join("\n");
}

function stageText(snapshot, fallbackPrefix = "阶段") {
  if (snapshot.currentStage?.label) {
    return `当前阶段: ${snapshot.currentStage.label}`;
  }
  if (snapshot.lastStage?.label) {
    return `${fallbackPrefix}: ${snapshot.lastStage.label}`;
  }

  return null;
}

function joinBody(parts) {
  return parts.filter(Boolean).join("\n\n");
}

function footerText(snapshot, footerFields) {
  return footerFields
    .map((field) => footerFieldText(field, snapshot))
    .filter(Boolean)
    .join(" | ");
}

function footerFieldText(field, snapshot) {
  switch (field) {
    case "status":
      return `状态: ${snapshot.status}`;
    case "thread":
      return snapshot.threadId ? `thread: ${shortId(snapshot.threadId)}` : null;
    case "turn":
      return snapshot.turnId ? `turn: ${shortId(snapshot.turnId)}` : null;
    case "elapsed":
      return typeof snapshot.elapsedMs === "number" ? `耗时: ${formatElapsed(snapshot.elapsedMs)}` : null;
    case "tokens":
      return tokenUsageText(snapshot.tokenUsage);
    case "model":
      return labeledFooterField("model", snapshot.model);
    case "version":
      return labeledFooterField("fca", snapshot.appVersion);
    case "error":
      return labeledFooterField("错误", snapshot.errorType);
    case "cwd":
      return snapshot.cwd ? `cwd: ${compactPath(snapshot.cwd)}` : null;
    default:
      return null;
  }
}

function labeledFooterField(label, value) {
  return value ? `${label}: ${truncateMiddle(String(value), FOOTER_FIELD_LIMIT)}` : null;
}

function tokenUsageText(tokenUsage) {
  if (!tokenUsage?.total) {
    return null;
  }

  const total = tokenUsage.total.totalTokens;
  const cached = tokenUsage.total.cachedInputTokens;
  const contextWindow = tokenUsage.modelContextWindow;
  const parts = [];

  if (Number.isFinite(total)) {
    parts.push(`tokens: ${formatCompactNumber(total)}`);
  }
  if (Number.isFinite(cached) && cached > 0) {
    parts.push(`cache: ${formatCompactNumber(cached)}`);
  }
  if (Number.isFinite(total) && Number.isFinite(contextWindow) && contextWindow > 0) {
    parts.push(`ctx: ${formatPercent(total / contextWindow)}`);
  }

  return parts.length > 0 ? parts.join(" / ") : null;
}

function shortId(value) {
  return value.slice(0, 8);
}

function compactPath(value) {
  const text = String(value);
  if (text.length <= FOOTER_FIELD_LIMIT) {
    return text;
  }

  const segments = text.split(/[\\/]+/).filter(Boolean);
  const tail = segments.slice(-2).join("\\") || text;
  return truncateMiddle(tail, FOOTER_FIELD_LIMIT);
}

function formatElapsed(elapsedMs) {
  const seconds = Math.max(elapsedMs, 0) / 1000;
  if (seconds < 60) {
    return `${Number(seconds.toFixed(1))}s`;
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatCompactNumber(value) {
  if (value < 1000) {
    return `${value}`;
  }

  if (value < 1_000_000) {
    return `${Number((value / 1000).toFixed(1))}k`;
  }

  return `${Number((value / 1_000_000).toFixed(1))}m`;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function truncate(value, limit) {
  const text = value || "";
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit)}...`;
}

function truncateMiddle(value, limit) {
  const text = value || "";
  if (text.length <= limit) {
    return text;
  }

  if (limit <= 3) {
    return ".".repeat(limit);
  }

  const prefixLength = Math.ceil((limit - 3) / 2);
  const suffixLength = Math.floor((limit - 3) / 2);
  return `${text.slice(0, prefixLength)}...${text.slice(-suffixLength)}`;
}
