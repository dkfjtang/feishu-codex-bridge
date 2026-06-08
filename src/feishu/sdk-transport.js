export class FeishuSdkTransport {
  #appId;
  #appSecret;
  #createClient;
  #clientPromise = null;

  constructor({ appId, appSecret, createClient = createDefaultClient }) {
    if (!appId?.trim() || !appSecret?.trim()) {
      throw new Error("FeishuSdkTransport requires FEISHU_APP_ID and FEISHU_APP_SECRET");
    }

    this.#appId = appId.trim();
    this.#appSecret = appSecret.trim();
    this.#createClient = createClient;
  }

  async sendMessage({ receiveIdType, receiveId, msgType, content }) {
    const client = await this.#client();
    return client.im.message.create({
      params: {
        receive_id_type: receiveIdType,
      },
      data: {
        receive_id: receiveId,
        msg_type: msgType,
        content,
      },
    });
  }

  async patchMessageCard({ messageId, card }) {
    const client = await this.#client();
    return client.im.message.patch({
      path: {
        message_id: messageId,
      },
      data: {
        content: JSON.stringify(card),
      },
    });
  }

  async probeBot() {
    const client = await this.#client();
    try {
      const response = await client.request({
        method: "POST",
        url: "/open-apis/bot/v1/openclaw_bot/ping",
        data: { needBotInfo: true },
      });

      if (response?.code && response.code !== 0) {
        return {
          ok: false,
          appId: this.#appId,
          error: response.msg || `code ${response.code}`,
        };
      }

      const botInfo = response?.data?.pingBotInfo;
      return {
        ok: true,
        appId: this.#appId,
        botOpenId: botInfo?.botID,
        botName: botInfo?.botName,
      };
    } catch (error) {
      return {
        ok: false,
        appId: this.#appId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async #client() {
    if (!this.#clientPromise) {
      this.#clientPromise = Promise.resolve(
        this.#createClient({
          appId: this.#appId,
          appSecret: this.#appSecret,
        }),
      );
    }

    return this.#clientPromise;
  }
}

async function createDefaultClient({ appId, appSecret }) {
  const sdk = await import("@larksuiteoapi/node-sdk");
  return new sdk.Client({
    appId,
    appSecret,
    appType: sdk.AppType.SelfBuild,
    domain: sdk.Domain.Feishu,
  });
}
