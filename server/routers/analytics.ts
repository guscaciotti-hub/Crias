import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { getDb } from "../db.js";
import { messages, conversations, workspaceMembers } from "../../drizzle/schema.js";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getWsId(userId: number): Promise<number> {
  const db = getDb();
  const member = db.select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers).where(eq(workspaceMembers.userId, userId)).get();
  if (!member) throw new TRPCError({ code: "NOT_FOUND" });
  return member.workspaceId;
}

export const analyticsRouter = router({
  stats: protectedProcedure
    .input(z.object({
      botId: z.number().optional(),
      period: z.enum(["7d", "30d", "90d"]).default("30d"),
    }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);

      const days = input.period === "7d" ? 7 : input.period === "30d" ? 30 : 90;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const allConvs = db.select().from(conversations)
        .where(eq(conversations.workspaceId, wsId)).all();

      const allMsgs = db.select().from(messages)
        .where(eq(messages.workspaceId, wsId)).all();

      const totalMessages = allMsgs.length;
      const totalConversations = allConvs.length;
      const handoffCount = allConvs.filter(c => c.status === "handoff").length;
      const closedCount = allConvs.filter(c => c.status === "closed").length;
      const resolutionRate = totalConversations > 0
        ? Math.round((closedCount / totalConversations) * 100)
        : 0;

      return {
        totalMessages,
        totalConversations,
        handoffCount,
        resolutionRate,
        period: input.period,
      };
    }),
});
