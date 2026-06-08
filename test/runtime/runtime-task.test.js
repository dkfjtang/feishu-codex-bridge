import assert from "node:assert/strict";
import { test } from "node:test";

import { RuntimeTask } from "../../src/runtime/runtime-task.js";

test("new runtime task starts queued with Feishu context", () => {
  const task = new RuntimeTask({
    taskId: "task_123",
    feishuMessageId: "msg_123",
    feishuOpenId: "ou_123",
    feishuChatId: "chat_123",
    cwd: "F:\\development\\f-codex",
  });

  assert.deepEqual(task.snapshot(), {
    taskId: "task_123",
    feishuMessageId: "msg_123",
    feishuOpenId: "ou_123",
    feishuChatId: "chat_123",
    cardMessageId: null,
    threadId: null,
    turnId: null,
    cwd: "F:\\development\\f-codex",
    status: "queued",
    summaryText: "Codex 正在处理...",
    finalText: "",
    errorSummary: null,
  });
});

test("thread result and turn started notification move task to running", () => {
  const task = new RuntimeTask({ taskId: "task_123" });

  task.attachThread("thr_123");
  task.handleCodexEvent({
    method: "turn/started",
    params: { turn: { id: "turn_123" } },
  });

  assert.equal(task.snapshot().threadId, "thr_123");
  assert.equal(task.snapshot().turnId, "turn_123");
  assert.equal(task.snapshot().status, "running");
});

test("agent message deltas update summary and final output", () => {
  const task = new RuntimeTask({
    taskId: "task_123",
    summaryLimit: 8,
  });

  task.handleCodexEvent({
    method: "item/agentMessage/delta",
    params: { delta: "abcdefghijk" },
  });

  assert.equal(task.snapshot().summaryText, "abcdefgh...");
  assert.equal(task.snapshot().finalText, "abcdefghijk");
});

test("turn completion marks task completed", () => {
  const task = new RuntimeTask({ taskId: "task_123" });

  task.handleCodexEvent({
    method: "turn/completed",
    params: { status: "success" },
  });

  assert.equal(task.snapshot().status, "completed");
});

test("turn failure records a readable error summary", () => {
  const task = new RuntimeTask({ taskId: "task_123" });

  task.handleCodexEvent({
    method: "turn/completed",
    params: { status: "failed", error: { message: "Tool approval denied" } },
  });

  const snapshot = task.snapshot();
  assert.equal(snapshot.status, "failed");
  assert.equal(snapshot.errorSummary, "Tool approval denied");
});
