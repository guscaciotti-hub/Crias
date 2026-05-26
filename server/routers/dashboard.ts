import { router, protectedProcedure } from "../trpc.js";
import { getDb } from "../db.js";
import { bots, conversations, messages, whatsappInstances, workspaceMembers } from "../../drizzle/schema.js";
import { eq, and, gte, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getWsId(userId: number): Promise<number> {
  const db = getDb();
  const member = db.select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers).where(eq(workspaceMembers.userId, userId)).get();
  if (!member) throw new TRPCError({ code: "NOT_FOUND" });
  return member.workspaceId;
}

export const dashboardRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const wsId = await getWsId(ctx.user.id);

    const botList = db.select().from(bots).where(eq(bots.workspaceId, wsId)).all();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const allConvs = db.select().from(conversations).where(eq(conversations.workspaceId, wsId)).all();
    const todayMsgs = db.select().from(messages)
      .where(and(eq(messages.workspaceId, wsId), gte(messages.createdAt, today)))
      .all();

    const activeConvs = allConvs.filter(c => c.status === "active").length;
    const handoffPending = allConvs.filter(c => c.status === "handoff").length;

    const botsWithStatus = botList.map(b => {
      const inst = db.select().from(whatsappInstances).where(eq(whatsappInstances.botId, b.id)).get();
      return { ...b, instance: inst ?? null };
    });

    const recentConvs = db.select({ conv: conversations })
      .from(conversations)
      .where(eq(conversations.workspaceId, wsId))
      .orderBy(desc(conversations.updatedAt))
      .limit(5)
      .all()
      .map(r => r.conv);

    return {
      totalBots: botList.length,
      messagesToday: todayMsgs.length,
      activeConversations: activeConvs,
      handoffPending,
      bots: botsWithStatus,
      recentConversations: recentConvs,
    };
  }),
});
