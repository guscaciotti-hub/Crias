import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { getDb } from "../db.js";
import { users, sessions, workspaceMembers, emailTokens } from "../../drizzle/schema.js";
import { eq, and, gt } from "drizzle-orm";
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { TRPCError } from "@trpc/server";
import { sendVerificationEmail, sendPasswordResetEmail } from "../email.js";

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

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function makeSessionToken(userId: number): string {
  const db = getDb();
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  db.insert(sessions).values({ id, userId, expiresAt }).run();
  return id;
}

function storeEmailToken(userId: number, type: "verify_email" | "reset_password"): string {
  const db = getDb();
  // Invalidate previous tokens of same type
  db.delete(emailTokens).where(and(eq(emailTokens.userId, userId), eq(emailTokens.type, type))).run();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  db.insert(emailTokens).values({ userId, code, type, expiresAt }).run();
  return code;
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
      const existing = db.select().from(users).where(eq(users.openId, openId)).get();

      // Migrated user (old demo_ account): no password yet → let them set one
      if (existing && !existing.passwordHash) {
        const updated = db.update(users)
          .set({ passwordHash: hashPassword(input.password), name: input.name, emailVerified: true })
          .where(eq(users.id, existing.id))
          .returning().get();
        const token = makeSessionToken(updated.id);
        const member = db.select({ id: workspaceMembers.id })
          .from(workspaceMembers).where(eq(workspaceMembers.userId, updated.id)).get();
        return { token, user: safeUser(updated), hasWorkspace: !!member, needsVerification: false };
      }

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado. Faça login." });
      }

      const isAdmin = input.email.toLowerCase() === ADMIN_EMAIL;
      const user = db.insert(users).values({
        openId,
        name: input.name,
        email: input.email,
        passwordHash: hashPassword(input.password),
        emailVerified: isAdmin, // admin bypasses verification
        role: isAdmin ? "admin" : "user",
      }).returning().get();

      if (!isAdmin) {
        const code = storeEmailToken(user.id, "verify_email");
        await sendVerificationEmail(user.email, user.name, code).catch(console.error);
        return { token: null, user: null, hasWorkspace: false, needsVerification: true, email: user.email };
      }

      const token = makeSessionToken(user.id);
      return { token, user: safeUser(user), hasWorkspace: false, needsVerification: false };
    }),

  verifyEmail: publicProcedure
    .input(z.object({ email: z.string().email(), code: z.string().length(6) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const openId = `local_${input.email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      const user = db.select().from(users).where(eq(users.openId, openId)).get();
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });

      const token = db.select().from(emailTokens).where(
        and(
          eq(emailTokens.userId, user.id),
          eq(emailTokens.type, "verify_email"),
          eq(emailTokens.code, input.code),
          gt(emailTokens.expiresAt, new Date()),
        )
      ).get();

      if (!token) throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido ou expirado." });

      db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id)).run();
      db.delete(emailTokens).where(eq(emailTokens.id, token.id)).run();

      const sessionToken = makeSessionToken(user.id);
      const member = db.select({ id: workspaceMembers.id })
        .from(workspaceMembers).where(eq(workspaceMembers.userId, user.id)).get();
      return { token: sessionToken, user: safeUser({ ...user, emailVerified: true }), hasWorkspace: !!member };
    }),

  resendVerification: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const openId = `local_${input.email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      const user = db.select().from(users).where(eq(users.openId, openId)).get();
      if (!user || user.emailVerified) return { ok: true };
      const code = storeEmailToken(user.id, "verify_email");
      await sendVerificationEmail(user.email, user.name, code).catch(console.error);
      return { ok: true };
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const openId = `local_${input.email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      const user = db.select().from(users).where(eq(users.openId, openId)).get();
      // Always return ok to avoid user enumeration
      if (!user || !user.passwordHash) return { ok: true };
      const code = storeEmailToken(user.id, "reset_password");
      await sendPasswordResetEmail(user.email, user.name, code).catch(console.error);
      return { ok: true };
    }),

  resetPassword: publicProcedure
    .input(z.object({
      email: z.string().email(),
      code: z.string().length(6),
      newPassword: z.string().min(6, "Senha mínima de 6 caracteres"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const openId = `local_${input.email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      const user = db.select().from(users).where(eq(users.openId, openId)).get();
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });

      const token = db.select().from(emailTokens).where(
        and(
          eq(emailTokens.userId, user.id),
          eq(emailTokens.type, "reset_password"),
          eq(emailTokens.code, input.code),
          gt(emailTokens.expiresAt, new Date()),
        )
      ).get();

      if (!token) throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido ou expirado." });

      db.update(users).set({ passwordHash: hashPassword(input.newPassword), emailVerified: true })
        .where(eq(users.id, user.id)).run();
      db.delete(emailTokens).where(eq(emailTokens.id, token.id)).run();

      const sessionToken = makeSessionToken(user.id);
      const member = db.select({ id: workspaceMembers.id })
        .from(workspaceMembers).where(eq(workspaceMembers.userId, user.id)).get();
      return { token: sessionToken, user: safeUser(user), hasWorkspace: !!member };
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
      if (invalid) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });

      if (!user!.emailVerified) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada." });
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
