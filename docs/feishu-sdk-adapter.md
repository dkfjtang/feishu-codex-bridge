# 飞书 SDK 适配层

## 目标

飞书 SDK 适配层负责把 fca 内部的消息动作转换成飞书 SDK 或 HTTP API 调用。业务层只处理 SDK 无关的 action，不直接依赖飞书 SDK 包。

```text
TaskCardController
  -> FeishuMessageClient
  -> Feishu SDK transport
  -> 飞书消息 API
```

## 当前边界

已落地：

- `FeishuMessageClient.sendAction(action)`。
- `send` action 转换为发送 interactive 消息。
- `update` action 转换为更新已发送消息卡片。
- transport 通过依赖注入提供，便于测试和后续替换 SDK。
- `FeishuSdkTransport` 使用 `@larksuiteoapi/node-sdk` 调用飞书消息 API。
- `FeishuSdkTransport.probeBot()` 通过 bot ping API 探测 bot open_id，用于自回声过滤。

## transport 接口

```js
{
  sendMessage: async ({
    receiveIdType,
    receiveId,
    msgType,
    content,
  }) => ({ data: { message_id: "om_xxx" } }),

  patchMessageCard: async ({
    messageId,
    card,
  }) => ({ data: {} }),
}
```

## 发送卡片

输入 action：

```js
{
  type: "send",
  receiveIdType: "chat_id",
  receiveId: "oc_xxx",
  messageType: "interactive",
  card: {}
}
```

transport payload：

```js
{
  receiveIdType: "chat_id",
  receiveId: "oc_xxx",
  msgType: "interactive",
  content: JSON.stringify(card)
}
```

返回值：

```js
{ messageId: "om_xxx" }
```

## 更新卡片

输入 action：

```js
{
  type: "update",
  messageId: "om_xxx",
  card: {}
}
```

transport payload：

```js
{
  messageId: "om_xxx",
  card
}
```

返回值：

```js
{}
```

## 后续接入点

- 使用飞书 Node SDK 实现长连接事件监听。
- 统一飞书 API 错误摘要。
- 增加消息长度和卡片 payload 尺寸保护。
- 增加交互卡片回调处理。
