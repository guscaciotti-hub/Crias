import { z } from "zod";
import { router, adminProcedure } from "../trpc.js";
import { getDb } from "../db.js";
import { users, workspaces, workspaceMembers, bots, messages, aiUsage } from "../../drizzle/schema.js";
import { eq, sql } from "drizzle-orm";

const USD_TO_BRL = Number(process.env.USD_TO_BRL ?? 5.2);

export const adminRouter = router({
  listWorkspaces: adminProcedure.query(async () => {
    const db = getDb();
    const allWorkspaces = db.select().from(workspaces).all();

    return allWorkspaces.map(ws => {
      const member = db.select({ userId: workspaceMembers.userId })
        .from(workspaceMembers).where(eq(workspaceMembers.workspaceId, ws.id)).get();
      const owner = member
        ? db.select().from(users).where(eq(users.id, member.userId)).get()
        : null;

      const botList = db.select({ id: bots.id, agentMode: bots.agentMode })
        .from(bots).where(eq(bots.workspaceId, ws.id)).all();

      const msgCount = db.select({ count: sql<number>`count(*)` })
        .from(messages).where(eq(messages.workspaceId, ws.id)).get();

      const usage = db.select({
        inputTokens: sql<number>`coalesce(sum(input_tokens),0)`,
        outputTokens: sql<number>`coalesce(sum(output_tokens),0)`,
        costUsd: sql<number>`coalesce(sum(cost_usd),0)`,
        calls: sql<number>`count(*)`,
      }).from(aiUsage).where(eq(aiUsage.workspaceId, ws.id)).get();

      const costUsd = Number(usage?.costUsd ?? 0);

      return {
        id: ws.id,
        name: ws.name,
        plan: ws.plan,
        createdAt: ws.createdAt,
        owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
        botCount: botList.length,
        aiBotCount: botList.filter(b => b.agentMode === "ai").length,
        messageCount: Number(msgCount?.count ?? 0),
        ai: {
          calls: Number(usage?.calls ?? 0),
          inputTokens: Number(usage?.inputTokens ?? 0),
          outputTokens: Number(usage?.outputTokens ?? 0),
          costUsd: Math.round(costUsd * 10000) / 10000,
          costBrl: Math.round(costUsd * USD_TO_BRL * 100) / 100,
        },
      };
    });
  }),

  listUsers: adminProcedure.query(async () => {
    const db = getDb();
    return db.select().from(users).all().map(u => {
      const member = db.select({ workspaceId: workspaceMembers.workspaceId })
        .from(workspaceMembers).where(eq(workspaceMembers.userId, u.id)).get();
      const ws = member
        ? db.select({ name: workspaces.name, plan: workspaces.plan })
            .from(workspaces).where(eq(workspaces.id, member.workspaceId)).get()
        : null;
      // never expose passwordHash to the client
      return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt, workspace: ws ?? null };
    });
  }),

  changePlan: adminProcedure
    .input(z.object({ workspaceId: z.number(), plan: z.enum(["trial", "starter", "pro", "business"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      db.update(workspaces).set({ plan: input.plan }).where(eq(workspaces.id, input.workspaceId)).run();
      return { ok: true };
    }),

  summary: adminProcedure.query(async () => {
    const db = getDb();
    const totalUsers    = Number(db.select({ c: sql<number>`count(*)` }).from(users).get()?.c ?? 0);
    const totalWs       = Number(db.select({ c: sql<number>`count(*)` }).from(workspaces).get()?.c ?? 0);
    const totalBots     = Number(db.select({ c: sql<number>`count(*)` }).from(bots).get()?.c ?? 0);
    const totalMessages = Number(db.select({ c: sql<number>`count(*)` }).from(messages).get()?.c ?? 0);
    const usageTotals   = db.select({
      costUsd: sql<number>`coalesce(sum(cost_usd),0)`,
      inputTokens: sql<number>`coalesce(sum(input_tokens),0)`,
      outputTokens: sql<number>`coalesce(sum(output_tokens),0)`,
    }).from(aiUsage).get();
    const byPlan = db.select({ plan: workspaces.plan, count: sql<number>`count(*)` })
      .from(workspaces).groupBy(workspaces.plan).all();
    const costUsd = Number(usageTotals?.costUsd ?? 0);

    return {
      totalUsers, totalWs, totalBots, totalMessages,
      totalCostUsd: Math.round(costUsd * 10000) / 10000,
      totalCostBrl: Math.round(costUsd * USD_TO_BRL * 100) / 100,
      totalInputTokens: Number(usageTotals?.inputTokens ?? 0),
      totalOutputTokens: Number(usageTotals?.outputTokens ?? 0),
      byPlan: Object.fromEntries(byPlan.map(r => [r.plan, Number(r.count)])),
    };
  }),

  deleteWorkspace: adminProcedure
    .input(z.object({ workspaceId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, input.workspaceId)).run();
      db.delete(workspaces).where(eq(workspaces.id, input.workspaceId)).run();
      return { ok: true };
    }),
});
