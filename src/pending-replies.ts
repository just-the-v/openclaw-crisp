/**
 * Pending Replies Store
 * 
 * Stores Crisp messages waiting for human approval before sending reply.
 */

export interface PendingReply {
  id: string;
  crispSessionId: string;
  crispWebsiteId: string;
  visitorName: string;
  visitorMessage: string;
  proposedReply: string;
  telegramMessageId?: string;
  telegramChatId?: string;
  createdAt: number;
  accountId: string;
}

// In-memory store for pending replies
const pendingReplies = new Map<string, PendingReply>();

// TTL for pending replies (1 hour)
const PENDING_REPLY_TTL_MS = 60 * 60 * 1000;

/**
 * Generate a short unique ID for the pending reply
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Store a pending reply
 */
export function storePendingReply(params: Omit<PendingReply, "id" | "createdAt">): PendingReply {
  const id = generateId();
  const pending: PendingReply = {
    ...params,
    id,
    createdAt: Date.now(),
  };
  
  pendingReplies.set(id, pending);
  
  // Cleanup old entries
  const cutoff = Date.now() - PENDING_REPLY_TTL_MS;
  for (const [key, value] of pendingReplies) {
    if (value.createdAt < cutoff) {
      pendingReplies.delete(key);
    }
  }
  
  return pending;
}

/**
 * Get a pending reply by ID
 */
export function getPendingReply(id: string): PendingReply | null {
  const pending = pendingReplies.get(id.toUpperCase());
  if (!pending) return null;
  
  // Check if expired
  if (Date.now() - pending.createdAt > PENDING_REPLY_TTL_MS) {
    pendingReplies.delete(id.toUpperCase());
    return null;
  }
  
  return pending;
}

/**
 * Remove a pending reply (after it's been handled)
 */
export function removePendingReply(id: string): boolean {
  return pendingReplies.delete(id.toUpperCase());
}

/**
 * Update telegram message info for a pending reply
 */
export function updatePendingReplyTelegram(
  id: string, 
  telegramMessageId: string, 
  telegramChatId: string
): void {
  const pending = pendingReplies.get(id.toUpperCase());
  if (pending) {
    pending.telegramMessageId = telegramMessageId;
    pending.telegramChatId = telegramChatId;
  }
}

/**
 * Find pending reply by Telegram message ID (for reply detection)
 */
export function findPendingReplyByTelegramMessage(
  telegramMessageId: string
): PendingReply | null {
  for (const pending of pendingReplies.values()) {
    if (pending.telegramMessageId === telegramMessageId) {
      return pending;
    }
  }
  return null;
}

/**
 * Get all pending replies (for debugging/listing)
 */
export function getAllPendingReplies(): PendingReply[] {
  const cutoff = Date.now() - PENDING_REPLY_TTL_MS;
  const results: PendingReply[] = [];
  
  for (const pending of pendingReplies.values()) {
    if (pending.createdAt >= cutoff) {
      results.push(pending);
    }
  }
  
  return results;
}

/**
 * List all pending replies (for debugging)
 */
export function listPendingReplies(): PendingReply[] {
  return Array.from(pendingReplies.values());
}
