import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { getDb } from "../db.js";
import { conversations, messages, contacts, workspaceMembers } from "../../drizzle/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { sendMessage } from "../whatsapp/baileys-manager.js";

async function getWsId(userId: number): Promise<number> {
  const db = getDb();
  const member = db.select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers).where(eq(workspaceMembers.userId, userId)).get();
  if (!member) throw new TRPCError({ code: "NOT_FOUND" });
  return member.workspaceId;
}

export const conversationsRouter = router({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().max(100).default(50),
      status: z.enum(["active", "handoff", "closed"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);

      const all = db.select({
        conversation: conversations,
        contact: contacts,
      }).from(conversations)
        .innerJoin(contacts, eq(conversations.contactId, contacts.id))
        .where(
          input.status
            ? and(eq(conversations.workspaceId, wsId), eq(conversations.status, input.status))
            : eq(conversations.workspaceId, wsId)
        )
        .orderBy(desc(conversations.updatedAt))
        .limit(input.limit)
        .all();

      return all.map(row => ({
        ...row.conversation,
        contact: row.contact,
        lastMessage: db.select().from(messages)
          .where(eq(messages.conversationId, row.conversation.id))
          .orderBy(desc(messages.createdAt))
          .limit(1)
          .get() ?? null,
      }));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);
      const conv = db.select().from(conversations)
        .where(and(eq(conversations.id, input.id), eq(conversations.workspaceId, wsId))).get();
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });
      const msgs = db.select().from(messages)
        .where(eq(messages.conversationId, input.id))
        .orderBy(messages.createdAt)
        .all();
      const contact = db.select().from(contacts).where(eq(contacts.id, conv.contactId)).get();
      return { ...conv, messages: msgs, contact };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["active", "handoff", "closed"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);
      return db.update(conversations)
        .set({ status: input.status, updatedAt: new Date() })
        .where(and(eq(conversations.id, input.id), eq(conversations.workspaceId, wsId)))
        .returning().get();
    }),

  sendHumanMessage: protectedProcedure
    .input(z.object({ conversationId: z.number(), text: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);

      const conv = db.select().from(conversations)
        .where(and(eq(conversations.id, input.conversationId), eq(conversations.workspaceId, wsId)))
        .get();
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });

      const contact = db.select().from(contacts).where(eq(contacts.id, conv.contactId)).get();
      if (!contact) throw new TRPCError({ code: "NOT_FOUND" });

      const jid = `${contact.phone}@s.whatsapp.net`;
      await sendMessage(conv.botId, jid, input.text);

      db.insert(messages).values({
        conversationId: conv.id, workspaceId: wsId, role: "human", content: input.text,
      }).run();

      db.update(conversations)
        .set({ status: "handoff", lastHumanActivityAt: new Date(), updatedAt: new Date() })
        .where(eq(conversations.id, conv.id))
        .run();

      const { clearConvCacheForContact } = await import("../whatsapp/message-bridge.js");
      clearConvCacheForContact(conv.botId, contact.phone);

      return { ok: true };
    }),

  humanTakeover: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);

      const conv = db.select().from(conversations)
        .where(and(eq(conversations.id, input.conversationId), eq(conversations.workspaceId, wsId)))
        .get();
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });

      db.update(conversations)
        .set({ status: "handoff", lastHumanActivityAt: new Date(), updatedAt: new Date() })
        .where(eq(conversations.id, conv.id))
        .run();

      const contact = db.select().from(contacts).where(eq(contacts.id, conv.contactId)).get();
      if (contact) {
        const { clearConvCacheForContact } = await import("../whatsapp/message-bridge.js");
        clearConvCacheForContact(conv.botId, contact.phone);
      }

      return { ok: true };
    }),
});
