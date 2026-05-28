import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { getDb } from "../db.js";
import { users, sessions, workspaceMembers } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { TRPCError } from "@trpc/server";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "guscaciotti@gmail.com").toLowerCase();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64);
  return `${salt}:${(hash as Buffer).toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const hashBuffer = Buffer.from(hash, "hex");
    const derived = scryptSync(password, salt, 64) as Buffer;
    return timingSafeEqual(hashBuffer, derived);
  } catch {
    return false;
  }
}

function makeSessionToken(userId: number): string {
  const db = getDb();
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  db.insert(sessions).values({ id, userId, expiresAt }).run();
  return id;
}

function safeUser(u: typeof users.$inferSelect) {
  const { passwordHash: _ph, ...rest } = u;
  return rest;
}

export const authRouter = router({
  register: publicProcedure
    .input(z.object({
      name: z.string().min(1, "Nome obrigatório"),
      email: z.string().email("E-mail inválido"),
      password: z.string().min(6, "Senha mínima de 6 caracteres"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const openId = `local_${input.email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

      const existing = db.select({ id: users.id }).from(users).where(eq(users.openId, openId)).get();
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado. Faça login." });
      }

      const user = db.insert(users).values({
        openId,
        name: input.name,
        email: input.email,
        passwordHash: hashPassword(input.password),
        role: input.email.toLowerCase() === ADMIN_EMAIL ? "admin" : "user",
      }).returning().get();

      const token = makeSessionToken(user.id);
      return { token, user: safeUser(user), hasWorkspace: false };
    }),

  login: publicProcedure
    .input(z.object({
      email: z.string().email("E-mail inválido"),
      password: z.string().min(1, "Senha obrigatória"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const openId = `local_${input.email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

      const user = db.select().from(users).where(eq(users.openId, openId)).get();
      const invalid = !user || !user.passwordHash || !verifyPassword(input.password, user.passwordHash);
      if (invalid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
      }

      const token = makeSessionToken(user!.id);
      const member = db.select({ id: workspaceMembers.id })
        .from(workspaceMembers).where(eq(workspaceMembers.userId, user!.id)).get();

      return { token, user: safeUser(user!), hasWorkspace: !!member };
    }),

  me: protectedProcedure.query(({ ctx }) => safeUser(ctx.user)),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const token = ctx.req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const db = getDb();
      db.delete(sessions).where(eq(sessions.id, token)).run();
    }
    return { ok: true };
  }),
});
