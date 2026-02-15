/**
 * Crisp Webhook Handler
 * 
 * Receives HTTP POST requests from Crisp and routes them to OpenClaw.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import {
  DEFAULT_WEBHOOK_PATH,
  buildCrispDashboardUrl,
  type CrispConfig,
  type CrispSessionState,
  type CrispWebhookPayload,
} from "./types.js";
import { createCrispClient } from "./api-client.js";

// In-memory session tracking for notification deduplication
const activeSessions = new Map<string, CrispSessionState>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Runtime reference (set by plugin registration)
let crispRuntime: CrispPluginRuntime | null = null;

export interface CrispPluginRuntime {
  log?: {
    info?: (msg: string) => void;
    warn?: (msg: string) => void;
    error?: (msg: string) => void;
  };
  handleInboundMessage: (params: {
    channel: string;
    accountId: string;
    senderId: string;
    senderName: string;
    chatId: string;
    text: string;
    messageId?: string;
    replyToId?: string;
    context?: Record<string, unknown>;
  }) => Promise<{ text?: string; error?: string }>;
  sendCrossChannelMessage?: (params: {
    channel: string;
    to: string;
    text: string;
  }) => Promise<void>;
}

export function setCrispRuntime(runtime: CrispPluginRuntime): void {
  crispRuntime = runtime;
}

export function getCrispRuntime(): CrispPluginRuntime | null {
  return crispRuntime;
}

/**
 * Get the configured webhook path
 */
export function resolveWebhookPath(config: CrispConfig): string {
  return config.webhookPath || DEFAULT_WEBHOOK_PATH;
}

/**
 * Validate the webhook secret from URL params
 */
function validateWebhookSecret(
  url: URL,
  expectedSecret: string
): boolean {
  const providedSecret = url.searchParams.get("secret");
  if (!providedSecret || !expectedSecret) return false;
  
  // Constant-time comparison to prevent timing attacks
  if (providedSecret.length !== expectedSecret.length) return false;
  let result = 0;
  for (let i = 0; i < providedSecret.length; i++) {
    result |= providedSecret.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Parse JSON body from request
 */
async function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Track session for notification deduplication
 */
function trackSession(
  sessionId: string,
  websiteId: string,
  accountId: string,
  visitorName: string,
  visitorEmail?: string
): CrispSessionState {
  const existing = activeSessions.get(sessionId);
  const now = Date.now();

  if (existing) {
    existing.lastMessageAt = now;
    existing.messageCount += 1;
    existing.isNew = false;
    return existing;
  }

  const session: CrispSessionState = {
    sessionId,
    websiteId,
    accountId,
    visitorName,
    visitorEmail,
    startedAt: now,
    lastMessageAt: now,
    messageCount: 1,
    isNew: true,
  };

  activeSessions.set(sessionId, session);

  // Cleanup old sessions periodically
  if (activeSessions.size > 100) {
    const cutoff = now - SESSION_TTL_MS;
    for (const [key, value] of activeSessions) {
      if (value.lastMessageAt < cutoff) {
        activeSessions.delete(key);
      }
    }
  }

  return session;
}

/**
 * Send notification for new conversation
 */
async function notifyNewConversation(
  config: CrispConfig,
  session: CrispSessionState
): Promise<void> {
  if (!config.notifyOnNew || !config.notifyTarget || !crispRuntime?.sendCrossChannelMessage) {
    return;
  }

  const [channel, to] = config.notifyTarget.split(":");
  if (!channel || !to) {
    crispRuntime?.log?.warn?.(`Invalid notifyTarget format: ${config.notifyTarget}`);
    return;
  }

  const crispUrl = buildCrispDashboardUrl(session.websiteId, session.sessionId);
  const message = `🆕 **New Crisp conversation**

👤 ${session.visitorName}${session.visitorEmail ? ` (${session.visitorEmail})` : ""}

🔗 [Open in Crisp](${crispUrl})`;

  try {
    await crispRuntime.sendCrossChannelMessage({ channel, to, text: message });
  } catch (err) {
    crispRuntime?.log?.error?.(`Failed to send notification: ${err}`);
  }
}

/**
 * Handle inbound message from Crisp
 */
async function handleInboundMessage(
  config: CrispConfig,
  accountId: string,
  payload: CrispWebhookPayload
): Promise<void> {
  const { data } = payload;

  // Skip non-user messages
  if (data.from !== "user") {
    console.log(`[crisp] Skipping message from: ${data.from}`);
    return;
  }

  // Skip unsupported message types
  if (data.type && data.type !== "text" && data.type !== "file") {
    console.log(`[crisp] Skipping unsupported message type: ${data.type}`);
    return;
  }

  const sessionId = data.session_id;
  const visitorName = data.user?.nickname || "Visitor";
  const isFile = data.type === "file";
  const messageText = isFile ? "" : (data.content || "");
  const mediaUrl = isFile ? (data.content || "") : undefined;

  console.log(`[crisp] 📩 Message from ${visitorName}: "${messageText}"`);
  console.log(`[crisp] Session: ${sessionId}, Website: ${data.website_id}`);

  // Track session for deduplication
  const session = trackSession(
    sessionId,
    data.website_id,
    accountId,
    visitorName,
    undefined
  );

  // Notify on new conversation
  if (session.isNew) {
    console.log(`[crisp] 🆕 New conversation started`);
    await notifyNewConversation(config, session);
  }

  // Skip if auto-reply is disabled
  if (!config.autoReply) {
    console.log(`[crisp] Auto-reply disabled, message logged only`);
    return;
  }

  // Route message to AI via runtime
  if (!crispRuntime) {
    console.error(`[crisp] ❌ Runtime not available, cannot route to AI`);
    return;
  }

  // Create client for API calls
  const client = createCrispClient({
    apiKeyId: config.apiKeyId,
    apiKeySecret: config.apiKeySecret,
  });

  // Fetch conversation history for AI context
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (config.historyLimit > 0) {
    try {
      const messages = await client.getMessages(
        data.website_id,
        sessionId,
        { limit: config.historyLimit }
      );
      // Format messages for AI context (oldest first)
      history = messages
        .reverse()
        .slice(0, -1) // Exclude the current message
        .map((msg) => ({
          role: (msg.from === "user" ? "user" : "assistant") as "user" | "assistant",
          content: msg.content,
        }));
    } catch (err) {
      console.warn(`[crisp] Failed to fetch history: ${err}`);
    }
  }

  try {
    const aiResponse = await crispRuntime.handleInboundMessage({
      channel: "crisp",
      accountId,
      senderId: sessionId,
      senderName: visitorName,
      chatId: sessionId,
      text: messageText,
      messageId: data.fingerprint?.toString(),
      context: {
        websiteId: data.website_id,
        origin: data.origin,
        ...(mediaUrl ? { mediaUrl } : {}),
        ...(history.length > 0 ? { history } : {}),
      },
    });

    if (aiResponse.error) {
      console.error(`[crisp] ❌ AI error: ${aiResponse.error}`);
      return;
    }

    if (!aiResponse.text) {
      console.log(`[crisp] AI returned empty response, skipping reply`);
      return;
    }

    // Send AI response back to Crisp
    await client.sendMessage({
      websiteId: data.website_id,
      sessionId,
      content: aiResponse.text,
    });
    console.log(`[crisp] ✅ Sent AI reply to ${sessionId}`);

    // Optionally resolve the conversation
    if (config.resolveOnReply) {
      await client.updateConversationState(data.website_id, sessionId, "resolved");
    }
  } catch (err) {
    console.error(`[crisp] ❌ Failed to handle message:`, err);
  }
}

/**
 * Main webhook handler - register with OpenClaw HTTP server
 */
export async function handleCrispWebhookRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: CrispConfig,
  accountId: string
): Promise<boolean> {
  console.log(`[crisp] Webhook request: ${req.method} ${req.url}`);

  // Only handle POST requests
  if (req.method !== "POST") {
    return false;
  }

  // Check if this is our webhook path
  const url = new URL(req.url ?? "", `http://${req.headers.host}`);
  const webhookPath = resolveWebhookPath(config);
  
  if (!url.pathname.startsWith(webhookPath)) {
    return false;
  }

  // Validate webhook secret
  if (!validateWebhookSecret(url, config.webhookSecret)) {
    crispRuntime?.log?.warn?.(`[crisp] Invalid webhook secret from ${req.socket.remoteAddress}`);
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid secret" }));
    return true;
  }

  try {
    // Parse body
    const body = await parseJsonBody(req) as CrispWebhookPayload;

    crispRuntime?.log?.info?.(`[crisp] Received webhook: ${body.event}`);

    // Route by event type
    switch (body.event) {
      case "message:send":
        await handleInboundMessage(config, accountId, body);
        break;

      case "session:set_state":
        // Track conversation state changes
        crispRuntime?.log?.info?.(`[crisp] Conversation ${body.data.session_id} state: ${body.data.state}`);
        break;

      case "session:set_email":
        // Update session email for notifications
        const session = activeSessions.get(body.data.session_id);
        if (session && body.data.email) {
          session.visitorEmail = body.data.email;
        }
        break;

      default:
        crispRuntime?.log?.info?.(`[crisp] Unhandled event: ${body.event}`);
    }

    // Always return 200 to Crisp
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return true;

  } catch (err) {
    console.error(`[crisp] Webhook error:`, err);
    crispRuntime?.log?.error?.(`[crisp] Webhook error: ${err}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal error" }));
    return true;
  }
}
