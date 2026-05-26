import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { getDb } from "../db.js";
import { workspaces, workspaceMembers, messages, bots, knowledgeDocuments } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { PLAN_LIMITS, PLAN_PRICES, PLAN_NAMES } from "../../shared/plans.js";
import { TRPCError } from "@trpc/server";

export const billingRouter = router({
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const member = db.select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers).where(eq(workspaceMembers.userId, ctx.user.id)).get();
    if (!member) throw new TRPCError({ code: "NOT_FOUND" });

    const workspace = db.select().from(workspaces).where(eq(workspaces.id, member.workspaceId)).get();
    if (!workspace) throw new TRPCError({ code: "NOT_FOUND" });

    const plan = workspace.plan as keyof typeof PLAN_LIMITS;
    const limits = PLAN_LIMITS[plan];

    const botCount = db.select().from(bots).where(eq(bots.workspaceId, member.workspaceId)).all().length;
    const msgCount = db.select().from(messages).where(eq(messages.workspaceId, member.workspaceId)).all().length;
    const docCount = db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.workspaceId, member.workspaceId)).all().length;

    return {
      plan,
      planName: PLAN_NAMES[plan],
      price: PLAN_PRICES[plan],
      limits,
      usage: { bots: botCount, messages: msgCount, docs: docCount },
    };
  }),

  upgradePlan: protectedProcedure
    .input(z.object({ plan: z.enum(["trial", "starter", "pro", "business"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const member = db.select({ workspaceId: workspaceMembers.workspaceId })
        .from(workspaceMembers).where(eq(workspaceMembers.userId, ctx.user.id)).get();
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      return db.update(workspaces)
        .set({ plan: input.plan })
        .where(eq(workspaces.id, member.workspaceId))
        .returning().get();
    }),
});
