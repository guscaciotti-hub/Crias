import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { getDb } from "../db.js";
import {
  bots, whatsappInstances, knowledgeDocuments, workspaceMembers
} from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { NICHE_TEMPLATES, PLAN_LIMITS, type Niche } from "../../shared/plans.js";

async function getWorkspaceId(userId: number): Promise<number> {
  const db = getDb();
  const member = db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .get();
  if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Workspace não encontrado" });
  return member.workspaceId;
}

export const botsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const wsId = await getWorkspaceId(ctx.user.id);
    const botList = db.select().from(bots).where(eq(bots.workspaceId, wsId)).all();
    return botList.map(bot => {
      const instance = db.select().from(whatsappInstances).where(eq(whatsappInstances.botId, bot.id)).get();
      return { ...bot, instance: instance ?? null };
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWorkspaceId(ctx.user.id);
      const bot = db.select().from(bots).where(and(eq(bots.id, input.id), eq(bots.workspaceId, wsId))).get();
      if (!bot) throw new TRPCError({ code: "NOT_FOUND" });
      const instance = db.select().from(whatsappInstances).where(eq(whatsappInstances.botId, bot.id)).get();
      return { ...bot, instance: instance ?? null };
    }),

  createFromTemplate: protectedProcedure
    .input(z.object({
      niche: z.enum(["clinic", "law", "realestate", "beauty", "restaurant", "ecommerce", "education", "freelancer", "custom"]),
      businessName: z.string().min(1),
      businessDescription: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWorkspaceId(ctx.user.id);

      const template = NICHE_TEMPLATES[input.niche as Niche];
      const welcomeMessage = template.welcomeMessage.replace("{businessName}", input.businessName);

      const bot = db.insert(bots).values({
        workspaceId: wsId,
        name: `${template.botName} — ${input.businessName}`,
        businessName: input.businessName,
        businessDescription: input.businessDescription,
        niche: input.niche,
        persona: template.persona.replace("{businessName}", input.businessName),
        tone: template.tone,
        systemPrompt: template.systemPrompt,
        welcomeMessage,
        handoffTriggers: template.handoffTriggers,
        forbiddenTopics: template.forbiddenTopics,
        status: "active",
      }).returning().get();

      // Insert FAQ examples as knowledge documents
      for (const faq of template.faqExamples) {
        db.insert(knowledgeDocuments).values({
          workspaceId: wsId,
          botId: bot.id,
          type: "faq",
          name: faq.question,
          content: `P: ${faq.question}\nR: ${faq.answer}`,
          status: "indexed",
          chunkCount: 1,
        }).run();
      }

      // Create WhatsApp instance
      db.insert(whatsappInstances).values({
        botId: bot.id,
        workspaceId: wsId,
        instanceName: `bot-${bot.id}`,
        status: "disconnected",
      }).run();

      // Auto-create default flow
      const { buildDefaultFlow } = await import("../routers/flows.js");
      await buildDefaultFlow(db, wsId, bot.id, input.niche as Niche, input.businessName);

      return bot;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      persona: z.string().optional(),
      tone: z.enum(["formal", "friendly", "professional", "casual"]).optional(),
      systemPrompt: z.string().optional(),
      agentMode: z.enum(["flow", "ai"]).optional(),
      aiSystemPrompt: z.string().optional(),
      welcomeMessage: z.string().optional(),
      offHoursMessage: z.string().optional(),
      handoffTriggers: z.array(z.string()).optional(),
      forbiddenTopics: z.array(z.string()).optional(),
      alertNumbers: z.array(z.string()).optional(),
      status: z.enum(["active", "inactive", "disconnected"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWorkspaceId(ctx.user.id);
      const { id, ...fields } = input;

      const bot = db.select().from(bots).where(and(eq(bots.id, id), eq(bots.workspaceId, wsId))).get();
      if (!bot) throw new TRPCError({ code: "NOT_FOUND" });

      return db.update(bots)
        .set({ ...fields, updatedAt: new Date() })
        .where(and(eq(bots.id, id), eq(bots.workspaceId, wsId)))
        .returning()
        .get();
    }),

  testAI: protectedProcedure
    .input(z.object({ botId: z.number(), message: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWorkspaceId(ctx.user.id);
      const bot = db.select().from(bots).where(and(eq(bots.id, input.botId), eq(bots.workspaceId, wsId))).get();
      if (!bot) throw new TRPCError({ code: "NOT_FOUND" });
      const { runAIAgent } = await import("../whatsapp/ai-agent.js");
      return runAIAgent(db, input.botId, -input.botId, input.message);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWorkspaceId(ctx.user.id);
      const bot = db.select().from(bots).where(and(eq(bots.id, input.id), eq(bots.workspaceId, wsId))).get();
      if (!bot) throw new TRPCError({ code: "NOT_FOUND" });
      db.delete(bots).where(eq(bots.id, input.id)).run();
      return { ok: true };
    }),
});
