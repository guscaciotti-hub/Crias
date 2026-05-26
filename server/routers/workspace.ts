import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { getDb } from "../db.js";
import { workspaces, workspaceMembers } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const workspaceRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const member = db
      .select({ workspace: workspaces })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, ctx.user.id))
      .get();
    return member?.workspace ?? null;
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const workspace = db.insert(workspaces).values({
        name: input.name,
        ownerId: ctx.user.id,
      }).returning().get();

      db.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId: ctx.user.id,
        role: "owner",
      }).run();

      return workspace;
    }),

  updateOnboarding: protectedProcedure
    .input(z.object({ completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const member = db
        .select({ workspaceId: workspaceMembers.workspaceId })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, ctx.user.id))
        .get();
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      return db.update(workspaces)
        .set({ onboardingCompleted: input.completed })
        .where(eq(workspaces.id, member.workspaceId))
        .returning()
        .get();
    }),
});
