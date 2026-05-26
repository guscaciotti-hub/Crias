import { initTRPC, TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { z } from "zod";
import { getDb } from "./db.js";
import { sessions, users } from "../drizzle/schema.js";
import { eq, and, gt } from "drizzle-orm";

export type Context = {
  req: Request;
  res: Response;
  user: typeof users.$inferSelect | null;
  workspaceId: number | null;
};

export async function createContext({ req, res }: { req: Request; res: Response }): Promise<Context> {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.session;
  let user: typeof users.$inferSelect | null = null;

  if (token) {
    try {
      const db = getDb();
      const now = Math.floor(Date.now() / 1000);
      const session = await db
        .select({ user: users })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date(now * 1000))))
        .get();
      if (session) user = session.user;
    } catch {}
  }

  const workspaceId = req.headers["x-workspace-id"]
    ? parseInt(req.headers["x-workspace-id"] as string)
    : null;

  return { req, res, user, workspaceId };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});
