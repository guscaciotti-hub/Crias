import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { getDb } from "../db.js";
import { whatsappInstances, workspaceMembers } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { forceRestartInstance, disconnectInstance, getInstanceStatus, getCurrentQR, getLastError } from "../whatsapp/baileys-manager.js";

async function getWsId(userId: number): Promise<number> {
  const db = getDb();
  const member = db.select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers).where(eq(workspaceMembers.userId, userId)).get();
  if (!member) throw new TRPCError({ code: "NOT_FOUND" });
  return member.workspaceId;
}

export const whatsappRouter = router({
  // Starts (or restarts) the Baileys instance — returns immediately.
  // The client polls whatsapp.status to get the live QR and connection state.
  generateQR: protectedProcedure
    .input(z.object({ botId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);

      const existing = db.select().from(whatsappInstances)
        .where(and(eq(whatsappInstances.botId, input.botId), eq(whatsappInstances.workspaceId, wsId))).get();

      if (!existing) {
        db.insert(whatsappInstances).values({
          botId: input.botId,
          workspaceId: wsId,
          instanceName: `bot-${input.botId}`,
          status: "qr_pending",
          lastQrAt: new Date(),
        }).run();
      } else {
        db.update(whatsappInstances)
          .set({ status: "qr_pending", lastQrAt: new Date(), updatedAt: new Date() })
          .where(eq(whatsappInstances.id, existing.id))
          .run();
      }

      // Kill any stale instance and start fresh (non-blocking)
      forceRestartInstance(input.botId);
      return { ok: true };
    }),

  status: protectedProcedure
    .input(z.object({ botId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);
      const instance = db.select().from(whatsappInstances)
        .where(and(eq(whatsappInstances.botId, input.botId), eq(whatsappInstances.workspaceId, wsId))).get();
      const liveStatus = getInstanceStatus(input.botId);
      return {
        status: liveStatus ?? instance?.status ?? "disconnected",
        phoneNumber: instance?.phoneNumber ?? null,
        qr: getCurrentQR(input.botId),
        lastError: getLastError(input.botId),
      };
    }),

  disconnect: protectedProcedure
    .input(z.object({ botId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);
      await disconnectInstance(input.botId);
      db.update(whatsappInstances)
        .set({ status: "disconnected", updatedAt: new Date() })
        .where(and(eq(whatsappInstances.botId, input.botId), eq(whatsappInstances.workspaceId, wsId)))
        .run();
      return { ok: true };
    }),
});
