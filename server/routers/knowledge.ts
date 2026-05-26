import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { getDb } from "../db.js";
import { knowledgeDocuments, knowledgeChunks, workspaceMembers } from "../../drizzle/schema.js";
import { eq, and, like } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getWsId(userId: number): Promise<number> {
  const db = getDb();
  const member = db.select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers).where(eq(workspaceMembers.userId, userId)).get();
  if (!member) throw new TRPCError({ code: "NOT_FOUND" });
  return member.workspaceId;
}

export const knowledgeRouter = router({
  list: protectedProcedure
    .input(z.object({ botId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);
      return db.select().from(knowledgeDocuments)
        .where(and(eq(knowledgeDocuments.botId, input.botId), eq(knowledgeDocuments.workspaceId, wsId)))
        .all();
    }),

  create: protectedProcedure
    .input(z.object({
      botId: z.number(),
      type: z.enum(["faq", "document", "url", "text"]),
      name: z.string().min(1),
      content: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);

      const doc = db.insert(knowledgeDocuments).values({
        workspaceId: wsId,
        botId: input.botId,
        type: input.type,
        name: input.name,
        content: input.content,
        status: "indexed",
        chunkCount: 1,
      }).returning().get();

      // Create a chunk for the document
      db.insert(knowledgeChunks).values({
        documentId: doc.id,
        workspaceId: wsId,
        botId: input.botId,
        content: input.content,
      }).run();

      return doc;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);
      db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, input.id)).run();
      db.delete(knowledgeDocuments)
        .where(and(eq(knowledgeDocuments.id, input.id), eq(knowledgeDocuments.workspaceId, wsId)))
        .run();
      return { ok: true };
    }),

  search: protectedProcedure
    .input(z.object({ botId: z.number(), query: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);
      return db.select().from(knowledgeChunks)
        .where(and(
          eq(knowledgeChunks.botId, input.botId),
          eq(knowledgeChunks.workspaceId, wsId),
          like(knowledgeChunks.content, `%${input.query}%`)
        ))
        .limit(5)
        .all();
    }),
});
