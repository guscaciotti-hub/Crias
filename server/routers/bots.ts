import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { getDb } from "../db.js";
import {
  bots, whatsappInstances, knowledgeDocuments, workspaceMembers
} from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { NICHE_TEMPLATES, PLAN_LIMITS, type Niche } from "../../shared/plans.js";
import OpenAI from "openai";

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({ apiKey: key });
}

async function generateAgentPrompt(opts: {
  businessName: string;
  businessDescription: string;
  tone: string;
  doRules?: string;
  dontRules?: string;
}): Promise<{ aiSystemPrompt: string; welcomeMessage: string }> {
  const openai = getOpenAI();
  const toneLabel = { formal: "formal", friendly: "amigável", professional: "profissional", casual: "casual" }[opts.tone] ?? "amigável";

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [{
      role: "system",
      content: "Você é especialista em criar prompts para agentes de atendimento WhatsApp em português brasileiro. Responda SOMENTE em JSON válido.",
    }, {
      role: "user",
      content: `Crie um prompt de sistema e uma mensagem de boas-vindas para um agente WhatsApp com estas informações:

Nome do negócio: ${opts.businessName}
Descrição: ${opts.businessDescription}
Tom de voz: ${toneLabel}
${opts.doRules ? `Regras (o que fazer):\n${opts.doRules}` : ""}
${opts.dontRules ? `Restrições (o que NÃO fazer):\n${opts.dontRules}` : ""}

Responda em JSON com exatamente estes campos:
{
  "aiSystemPrompt": "prompt completo do agente (2-4 parágrafos, em português, define identidade, comportamento, quando transferir para humano)",
  "welcomeMessage": "mensagem curta de boas-vindas que o bot envia quando o cliente escreve pela primeira vez"
}`,
    }],
  });

  try {
    const parsed = JSON.parse(res.choices[0].message.content ?? "{}");
    return {
      aiSystemPrompt: parsed.aiSystemPrompt ?? "",
      welcomeMessage: parsed.welcomeMessage ?? `Olá! Bem-vindo à ${opts.businessName}. Como posso ajudar?`,
    };
  } catch {
    return {
      aiSystemPrompt: "",
      welcomeMessage: `Olá! Bem-vindo à ${opts.businessName}. Como posso ajudar?`,
    };
  }
}

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

  // Legacy: create from niche template
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
      for (const faq of template.faqExamples) {
        db.insert(knowledgeDocuments).values({
          workspaceId: wsId, botId: bot.id, type: "faq", name: faq.question,
          content: `P: ${faq.question}\nR: ${faq.answer}`, status: "indexed", chunkCount: 1,
        }).run();
      }
      db.insert(whatsappInstances).values({ botId: bot.id, workspaceId: wsId, instanceName: `bot-${bot.id}`, status: "disconnected" }).run();
      const { buildDefaultFlow } = await import("../routers/flows.js");
      await buildDefaultFlow(db, wsId, bot.id, input.niche as Niche, input.businessName);
      return bot;
    }),

  // Fluxo 1: IA gera a configuração inicial
  createWithAI: protectedProcedure
    .input(z.object({
      businessName: z.string().min(1),
      businessDescription: z.string().min(10, "Descreva o negócio em pelo menos 10 caracteres"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWorkspaceId(ctx.user.id);

      const generated = await generateAgentPrompt({
        businessName: input.businessName,
        businessDescription: input.businessDescription,
        tone: "friendly",
      });

      const bot = db.insert(bots).values({
        workspaceId: wsId,
        name: input.businessName,
        businessName: input.businessName,
        businessDescription: input.businessDescription,
        niche: "custom",
        tone: "friendly",
        agentMode: "ai",
        aiSystemPrompt: generated.aiSystemPrompt,
        welcomeMessage: generated.welcomeMessage,
        handoffTriggers: ["quero falar com atendente", "atendente humano", "falar com humano"],
        forbiddenTopics: [],
        status: "active",
      }).returning().get();

      db.insert(whatsappInstances).values({
        botId: bot.id, workspaceId: wsId, instanceName: `bot-${bot.id}`, status: "disconnected",
      }).run();

      return bot;
    }),

  // Mundo 2: cria um Fluxo (árvore de menus/botões)
  createFlow: protectedProcedure
    .input(z.object({ businessName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWorkspaceId(ctx.user.id);

      const bot = db.insert(bots).values({
        workspaceId: wsId,
        name: input.businessName,
        businessName: input.businessName,
        niche: "custom",
        tone: "friendly",
        agentMode: "flow",
        status: "active",
      }).returning().get();

      db.insert(whatsappInstances).values({
        botId: bot.id, workspaceId: wsId, instanceName: `bot-${bot.id}`, status: "disconnected",
      }).run();

      const { buildDefaultFlow } = await import("../routers/flows.js");
      await buildDefaultFlow(db, wsId, bot.id, "custom" as Niche, input.businessName);

      return bot;
    }),

  // Fluxo 2: usuário configura tudo manualmente
  createBlank: protectedProcedure
    .input(z.object({ businessName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWorkspaceId(ctx.user.id);

      const bot = db.insert(bots).values({
        workspaceId: wsId,
        name: input.businessName,
        businessName: input.businessName,
        niche: "custom",
        tone: "friendly",
        agentMode: "ai",
        aiSystemPrompt: "",
        welcomeMessage: "",
        handoffTriggers: [],
        forbiddenTopics: [],
        status: "active",
      }).returning().get();

      db.insert(whatsappInstances).values({
        botId: bot.id, workspaceId: wsId, instanceName: `bot-${bot.id}`, status: "disconnected",
      }).run();

      return bot;
    }),

  // Regenera o prompt principal com base na config atual
  generatePrompt: protectedProcedure
    .input(z.object({
      botId: z.number(),
      businessDescription: z.string(),
      tone: z.string(),
      doRules: z.string().optional(),
      dontRules: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWorkspaceId(ctx.user.id);
      const bot = db.select().from(bots).where(and(eq(bots.id, input.botId), eq(bots.workspaceId, wsId))).get();
      if (!bot) throw new TRPCError({ code: "NOT_FOUND" });

      const generated = await generateAgentPrompt({
        businessName: bot.businessName,
        businessDescription: input.businessDescription || bot.businessDescription || bot.businessName,
        tone: input.tone,
        doRules: input.doRules,
        dontRules: input.dontRules,
      });

      return { aiSystemPrompt: generated.aiSystemPrompt };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      businessDescription: z.string().optional(),
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
        .returning().get();
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

