import { getDb } from "../db.js";
import { bots, contacts, conversations, messages } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { sendMessage } from "./baileys-manager.js";
import { clearConvCacheForContact } from "./message-bridge.js";

const TICK_INTERVAL_MS = 60_000; // run every 60 seconds

async function tick() {
  try {
    const db = getDb();
    const now = Date.now();

    // Fetch all handoff conversations
    const handoffConvs = db.select().from(conversations)
      .where(eq(conversations.status, "handoff"))
      .all();

    for (const conv of handoffConvs) {
      try {
        // Get bot config
        const bot = db.select().from(bots).where(eq(bots.id, conv.botId)).get();
        if (!bot) continue;
        if (!bot.reactivationEnabled) continue;
        if (!conv.lastHumanActivityAt) continue;

        const timeoutMs = (bot.reactivationTimeoutMin ?? 30) * 60_000;
        const elapsed = now - conv.lastHumanActivityAt.getTime();
        if (elapsed < timeoutMs) continue;

        // Get contact phone
        const contact = db.select().from(contacts).where(eq(contacts.id, conv.contactId)).get();
        if (!contact) continue;

        const reactivationMsg = bot.reactivationMessage ||
          "Atendimento encerrado. Estou aqui se precisar de mais ajuda!";

        const jid = `${contact.phone}@s.whatsapp.net`;
        await sendMessage(conv.botId, jid, reactivationMsg);

        db.insert(messages).values({
          conversationId: conv.id,
          workspaceId: conv.workspaceId,
          role: "bot",
          content: reactivationMsg,
        }).run();

        db.update(conversations)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(conversations.id, conv.id))
          .run();

        clearConvCacheForContact(conv.botId, contact.phone);

        console.log(`[ReactivationTimer] Bot ${conv.botId} conversation ${conv.id} reactivated for contact ${contact.phone}`);
      } catch (e) {
        console.error(`[ReactivationTimer] Error processing conversation ${conv.id}:`, e);
      }
    }
  } catch (e) {
    console.error("[ReactivationTimer] Tick error:", e);
  }
}

export function startReactivationTimer() {
  console.log("[ReactivationTimer] Started — checking every 60s");
  setInterval(tick, TICK_INTERVAL_MS);
}
