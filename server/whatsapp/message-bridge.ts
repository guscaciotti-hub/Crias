import { setMessageHandler } from "./baileys-manager.js";
import { getDb } from "../db.js";
import { bots, contacts, conversations, messages } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { executeFlowStep } from "../routers/flows.js";

// Caches to avoid repeated DB queries
const botWsCache = new Map<number, number>(); // botId → workspaceId
const convCache = new Map<string, number>(); // `${botId}:${phone}` → conversationId

export async function initMessageBridge() {
  setMessageHandler(async (botId, from, text) => {
    try {
      const db = getDb();
      const phone = from.split("@")[0];

      // Resolve workspaceId (cached)
      let wsId = botWsCache.get(botId);
      if (wsId === undefined) {
        const bot = db.select({ workspaceId: bots.workspaceId }).from(bots).where(eq(bots.id, botId)).get();
        if (!bot) return null;
        wsId = bot.workspaceId;
        botWsCache.set(botId, wsId);
      }
      const resolvedWsId: number = wsId;

      // Resolve or create contact
      let contact = db.select().from(contacts)
        .where(and(eq(contacts.botId, botId), eq(contacts.phone, phone))).get();

      if (!contact) {
        contact = db.insert(contacts).values({
          botId,
          workspaceId: resolvedWsId,
          phone,
          name: phone,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          messageCount: 0,
        }).returning().get();
      } else {
        db.update(contacts)
          .set({ lastSeenAt: new Date(), messageCount: (contact.messageCount ?? 0) + 1 })
          .where(eq(contacts.id, contact.id))
          .run();
      }

      const contactId = contact.id;

      // Resolve or create conversation
      const cacheKey = `${botId}:${phone}`;
      let convId = convCache.get(cacheKey);
      if (convId === undefined) {
        const existing = db.select().from(conversations)
          .where(and(
            eq(conversations.botId, botId),
            eq(conversations.contactId, contactId),
            eq(conversations.status, "active")
          )).get();

        if (existing) {
          convId = existing.id;
        } else {
          const newConv = db.insert(conversations).values({
            botId,
            workspaceId: resolvedWsId,
            contactId,
            status: "active",
          }).returning().get();
          convId = newConv.id;
        }
        convCache.set(cacheKey, convId);
      }
      const resolvedConvId: number = convId;

      // Save user message (fire-and-forget)
      db.insert(messages).values({
        conversationId: resolvedConvId,
        workspaceId: resolvedWsId,
        role: "user",
        content: text,
      }).run();

      // Execute flow
      const result = await executeFlowStep(db, resolvedWsId, resolvedConvId, botId, text);

      // Save bot reply (fire-and-forget)
      db.insert(messages).values({
        conversationId: resolvedConvId,
        workspaceId: resolvedWsId,
        role: "bot",
        content: result.reply,
      }).run();

      // Handle handoff
      if (result.isHandoff) {
        db.update(conversations)
          .set({ status: "handoff", updatedAt: new Date() })
          .where(eq(conversations.id, resolvedConvId))
          .run();
        convCache.delete(cacheKey); // invalidate cache
      }

      return result.reply;
    } catch (e) {
      console.error("[MessageBridge] Error:", e);
      return null;
    }
  });
}
