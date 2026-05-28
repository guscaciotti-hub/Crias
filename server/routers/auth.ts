import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { getDb } from "../db.js";
import { users, sessions, workspaces, workspaceMembers } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export const authRouter = router({
  // Demo login - in production this would be OAuth2
  login: publicProcedure
    .input(z.object({ email: z.string().email(), name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const openId = `demo_${input.email.replace(/[^a-z0-9]/gi, "_")}`;

      // Upsert user
      let user = db.select().from(users).where(eq(users.openId, openId)).get();
      if (!user) {
        const result = db.insert(users).values({
          openId,
          name: input.name,
          email: input.email,
          role: input.email === "admin@atendeai.com" ? "admin" : "user",
        }).returning().get();
        user = result;
      }

      // Create session
      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      db.insert(sessions).values({
        id: sessionId,
        userId: user.id,
        expiresAt,
      }).run();

      const member = db.select().from(workspaceMembers)
        .where(eq(workspaceMembers.userId, user.id)).get();

      return { token: sessionId, user, hasWorkspace: !!member };
    }),

  me: protectedProcedure.query(({ ctx }) => ctx.user),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const token = ctx.req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const db = getDb();
      db.delete(sessions).where(eq(sessions.id, token)).run();
    }
    return { ok: true };
  }),
});
