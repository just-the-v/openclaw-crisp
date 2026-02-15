/**
 * Crisp Channel Plugin - Types
 */

import { z } from "zod";

// ============================================================================
// Config Types
// ============================================================================

export const CrispConfigSchema = z.object({
  /** Crisp website ID (UUID) */
  websiteId: z.string().uuid(),
  /** Crisp API key identifier */
  apiKeyId: z.string().min(1),
  /** Crisp API key secret */
  apiKeySecret: z.string().min(1),
  /** Webhook endpoint path */
  webhookPath: z.string().default("/crisp-webhook"),
  /** Secret for webhook URL validation */
  webhookSecret: z.string().min(16),
  /** Enable/disable the channel */
  enabled: z.boolean().default(true),
  /** Display name for this account */
  name: z.string().optional(),
  /** AI auto-responds to visitors */
  autoReply: z.boolean().default(true),
  /** Name shown as operator in Crisp */
  operatorName: z.string().default("Assistant"),
  /** Avatar URL for operator */
  operatorAvatar: z.string().url().optional(),
  /** Send notification on new conversations */
  notifyOnNew: z.boolean().default(false),
  /** Target for notifications (e.g., telegram:123456) */
  notifyTarget: z.string().optional(),
  /** Messages to include as AI context */
  historyLimit: z.number().int().min(0).max(50).default(10),
  /** Mark conversation resolved after reply */
  resolveOnReply: z.boolean().default(false),
});

export type CrispConfig = z.infer<typeof CrispConfigSchema>;

// ============================================================================
// Crisp API Types
// ============================================================================

export interface CrispWebhookPayload {
  website_id: string;
  event: string;
  data: CrispWebhookData;
  timestamp: number;
}

export interface CrispWebhookData {
  website_id: string;
  session_id: string;
  type?: "text" | "file" | "animation" | "audio" | "picker" | "field" | "carousel";
  content?: string;
  from?: "user" | "operator";
  origin?: "chat" | "email";
  stamped?: boolean;
  timestamp?: number;
  fingerprint?: number;
  user?: {
    nickname: string;
    user_id: string;
  };
  // Session state events
  state?: "pending" | "unresolved" | "resolved";
  // Email events
  email?: string;
  // Nickname events
  nickname?: string;
}

export interface CrispMessage {
  session_id: string;
  website_id: string;
  type: "text" | "file" | "animation" | "audio" | "note";
  content: string;
  from: "user" | "operator";
  origin: "chat" | "email";
  timestamp: number;
  fingerprint: number;
  user?: {
    nickname: string;
    user_id: string;
    avatar?: string;
  };
}

export interface CrispConversation {
  session_id: string;
  website_id: string;
  state: "pending" | "unresolved" | "resolved";
  is_verified: boolean;
  is_blocked: boolean;
  availability: "online" | "offline";
  created_at: number;
  updated_at: number;
  meta: {
    nickname?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    ip?: string;
    device?: {
      geolocation?: {
        country?: string;
        city?: string;
      };
    };
  };
}

export interface CrispSendMessageParams {
  websiteId: string;
  sessionId: string;
  content: string;
  type?: "text" | "file" | "animation";
  from?: "operator";
  origin?: "chat";
}

export interface CrispSendMessageResponse {
  error: boolean;
  reason?: string;
  data?: {
    fingerprint: number;
  };
}

// ============================================================================
// Internal Types
// ============================================================================

export interface CrispSessionState {
  sessionId: string;
  websiteId: string;
  accountId: string;
  visitorName: string;
  visitorEmail?: string;
  startedAt: number;
  lastMessageAt: number;
  messageCount: number;
  isNew: boolean;
}

export interface ResolvedCrispAccount {
  accountId: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  config: CrispConfig;
  baseUrl: string;
}

// ============================================================================
// Constants
// ============================================================================

export const CRISP_API_BASE = "https://api.crisp.chat/v1";
export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_WEBHOOK_PATH = "/crisp-webhook";

// ============================================================================
// Helpers
// ============================================================================

export function buildCrispApiUrl(path: string): string {
  return `${CRISP_API_BASE}${path}`;
}

export function buildCrispDashboardUrl(websiteId: string, sessionId: string): string {
  return `https://app.crisp.chat/website/${websiteId}/inbox/${sessionId}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}
