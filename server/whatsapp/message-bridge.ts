import { setMessageHandler } from "./baileys-manager.js";
import { getDb } from "../db.js";
import { bots, contacts, conversations, messages } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { executeFlowStep } from "../routers/flows.js";
import { runAIAgent } from "./ai-agent.js";

const botWsCache = new Map<number, number>();
const convCache = new Map<string, number>();

export async function initMessageBridge() {
  setMessageHandler(async (botId, from, text) => {
    try {
      const db = getDb();
      const phone = from.split("@")[0];

      // Resolve workspaceId + bot mode (cached)
      let wsId = botWsCache.get(botId);
      let botRow: typeof bots.$inferSelect | undefined;
      if (wsId === undefined) {
        botRow = db.select().from(bots).where(eq(bots.id, botId)).get();
        if (!botRow) return null;
        wsId = botRow.workspaceId;
        botWsCache.set(botId, wsId);
      }
      const resolvedWsId: number = wsId;

      // Lazy-load bot if not already fetched
      if (!botRow) {
        botRow = db.select().from(bots).where(eq(bots.id, botId)).get();
        if (!botRow) return null;
      }

      // Resolve or create contact
      let contact = db.select().from(contacts)
        .where(and(eq(contacts.botId, botId), eq(contacts.phone, phone))).get();

      if (!contact) {
        contact = db.insert(contacts).values({
          botId, workspaceId: resolvedWsId, phone, name: phone,
          firstSeenAt: new Date(), lastSeenAt: new Date(), messageCount: 0,
        }).returning().get();
      } else {
        db.update(contacts)
          .set({ lastSeenAt: new Date(), messageCount: (contact.messageCount ?? 0) + 1 })
          .where(eq(contacts.id, contact.id)).run();
      }

      // Resolve or create conversation
      const cacheKey = `${botId}:${phone}`;
      let convId = convCache.get(cacheKey);
      if (convId === undefined) {
        const existing = db.select().from(conversations)
          .where(and(
            eq(conversations.botId, botId),
            eq(conversations.contactId, contact.id),
            eq(conversations.status, "active")
          )).get();
        convId = existing
          ? existing.id
          : db.insert(conversations).values({
              botId, workspaceId: resolvedWsId, contactId: contact.id, status: "active",
            }).returning().get().id;
        convCache.set(cacheKey, convId);
      }
      const resolvedConvId: number = convId;

      // Save user message
      db.insert(messages).values({
        conversationId: resolvedConvId, workspaceId: resolvedWsId, role: "user", content: text,
      }).run();

      // Route to AI or Flow engine
      let reply: string;
      let isHandoff: boolean;

      if (botRow.agentMode === "ai") {
        const result = await runAIAgent(db, botId, resolvedConvId, text);
        reply = result.reply;
        isHandoff = result.isHandoff;
      } else {
        const result = await executeFlowStep(db, resolvedWsId, resolvedConvId, botId, text);
        reply = result.reply;
        isHandoff = result.isHandoff;
      }

      // Save bot reply
      db.insert(messages).values({
        conversationId: resolvedConvId, workspaceId: resolvedWsId, role: "bot", content: reply,
      }).run();

      if (isHandoff) {
        db.update(conversations)
          .set({ status: "handoff", updatedAt: new Date() })
          .where(eq(conversations.id, resolvedConvId)).run();
        convCache.delete(cacheKey);
      }

      return reply;
    } catch (e) {
      console.error("[MessageBridge] Error:", e);
      return null;
    }
  });
}
