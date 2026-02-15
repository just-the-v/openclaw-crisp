/**
 * Telegram Notification Helper
 * 
 * Sends approval notifications directly to Telegram.
 */

interface TelegramNotifyOptions {
  botToken: string;
  chatId: string;
  pendingId: string;
  visitorName: string;
  visitorMessage: string;
}

/**
 * Send a Crisp message notification to Telegram with inline buttons
 */
export async function sendTelegramNotification(opts: TelegramNotifyOptions): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const { botToken, chatId, pendingId, visitorName, visitorMessage } = opts;

  const text = `🆕 *Nouveau message Crisp* \\[${pendingId}\\]\n\n` +
    `👤 *${escapeMarkdown(visitorName)}*\n` +
    `💬 "${escapeMarkdown(visitorMessage)}"\n\n` +
    `_Réponds à ce message pour envoyer ta réponse, ou ignore\\._`;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Répondre", callback_data: `crisp_reply_${pendingId}` },
              { text: "❌ Ignorer", callback_data: `crisp_ignore_${pendingId}` },
            ],
          ],
        },
      }),
    });

    const data = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string };

    if (!data.ok) {
      console.error(`[crisp] Telegram API error:`, data);
      return { ok: false, error: data.description || "Unknown error" };
    }

    return { ok: true, messageId: data.result?.message_id };
  } catch (err) {
    console.error(`[crisp] Failed to send Telegram notification:`, err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Escape special characters for Telegram MarkdownV2
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}
