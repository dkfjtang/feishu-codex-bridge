import assert from "node:assert/strict";
import { test } from "node:test";

import { RuntimeTask } from "../../src/runtime/runtime-task.js";
import { TaskCardController } from "../../src/feishu/task-card-controller.js";

test("sync sends a new card and attaches returned card message id", async () => {
  const task = new RuntimeTask({
    taskId: "task_123",
    feishuChatId: "oc_123",
    cwd: "F:\\development\\f-codex",
  });
  const actions = [];
  const controller = new TaskCardController({
    sendAction: async (action) => {
      actions.push(action);
      return { messageId: "om_123" };
    },
  });

  await controller.sync(task);

  assert.equal(actions[0].type, "send");
  assert.equal(actions[0].receiveId, "oc_123");
  assert.equal(task.snapshot().cardMessageId, "om_123");
});

test("sync updates existing card without replacing card message id", async () => {
  const task = new RuntimeTask({
    taskId: "task_123",
    feishuChatId: "oc_123",
    cwd: "F:\\development\\f-codex",
  });
  task.attachCard("om_123");
  task.handleCodexEvent({
    method: "turn/started",
    params: { turn: { id: "turn_123" } },
  });

  const actions = [];
  const controller = new TaskCardController({
    sendAction: async (action) => {
      actions.push(action);
      return {};
    },
  });

  await controller.sync(task);

  assert.equal(actions[0].type, "update");
  assert.equal(actions[0].messageId, "om_123");
  assert.equal(task.snapshot().cardMessageId, "om_123");
});

test("sync surfaces sender failures", async () => {
  const task = new RuntimeTask({
    taskId: "task_123",
    feishuChatId: "oc_123",
  });
  const controller = new TaskCardController({
    sendAction: async () => {
      throw new Error("Feishu API failed");
    },
  });

  await assert.rejects(() => controller.sync(task), /Feishu API failed/);
});
