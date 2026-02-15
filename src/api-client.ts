/**
 * Crisp REST API Client
 */

import {
  buildCrispApiUrl,
  DEFAULT_TIMEOUT_MS,
  type CrispConversation,
  type CrispMessage,
  type CrispSendMessageParams,
  type CrispSendMessageResponse,
} from "./types.js";

export interface CrispApiClientOptions {
  apiKeyId: string;
  apiKeySecret: string;
  timeoutMs?: number;
}

export interface CrispApiClient {
  /**
   * Send a message to a Crisp conversation
   */
  sendMessage(params: CrispSendMessageParams): Promise<{ fingerprint: number }>;

  /**
   * Get conversation details
   */
  getConversation(websiteId: string, sessionId: string): Promise<CrispConversation>;

  /**
   * Get messages from a conversation
   */
  getMessages(
    websiteId: string,
    sessionId: string,
    opts?: { limit?: number }
  ): Promise<CrispMessage[]>;

  /**
   * Update conversation state (resolve/unresolve)
   */
  updateConversationState(
    websiteId: string,
    sessionId: string,
    state: "resolved" | "unresolved"
  ): Promise<void>;
}

/**
 * Create a Crisp API client
 */
export function createCrispClient(opts: CrispApiClientOptions): CrispApiClient {
  const { apiKeyId, apiKeySecret, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;

  // Build Basic Auth header
  const authHeader = `Basic ${Buffer.from(`${apiKeyId}:${apiKeySecret}`).toString("base64")}`;

  async function crispFetch<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    const url = buildCrispApiUrl(path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          "X-Crisp-Tier": "plugin",
          ...init.headers,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `Crisp API error: ${response.status} ${response.statusText} - ${errorBody}`
        );
      }

      const json = await response.json();
      
      // Crisp wraps responses in { error: boolean, data: T }
      if (json.error) {
        throw new Error(`Crisp API error: ${json.reason || "Unknown error"}`);
      }

      return json.data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async sendMessage(params: CrispSendMessageParams) {
      const { websiteId, sessionId, content, type = "text" } = params;
      const path = `/website/${websiteId}/conversation/${sessionId}/message`;

      const body = {
        type,
        content,
        from: "operator",
        origin: "chat",
      };

      const response = await crispFetch<{ fingerprint: number }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });

      return { fingerprint: response.fingerprint };
    },

    async getConversation(websiteId: string, sessionId: string) {
      const path = `/website/${websiteId}/conversation/${sessionId}`;
      return crispFetch<CrispConversation>(path);
    },

    async getMessages(
      websiteId: string,
      sessionId: string,
      opts?: { limit?: number }
    ) {
      const limit = opts?.limit ?? 20;
      const path = `/website/${websiteId}/conversation/${sessionId}/messages?limit=${limit}`;
      return crispFetch<CrispMessage[]>(path);
    },

    async updateConversationState(
      websiteId: string,
      sessionId: string,
      state: "resolved" | "unresolved"
    ) {
      const path = `/website/${websiteId}/conversation/${sessionId}/state`;
      await crispFetch<void>(path, {
        method: "PATCH",
        body: JSON.stringify({ state }),
      });
    },
  };
}
