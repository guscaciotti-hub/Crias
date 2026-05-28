import OpenAI from "openai";
import { getDb, type Db } from "../db.js";
import { bots, knowledgeChunks, messages } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({ apiKey: key });
}

export async function runAIAgent(
  db: Db,
  botId: number,
  conversationId: number,
  userMessage: string
): Promise<{ reply: string; isHandoff: boolean }> {
  const bot = db.select().from(bots).where(eq(bots.id, botId)).get();
  if (!bot) return { reply: "Olá! Como posso ajudar?", isHandoff: false };

  // Fetch last 10 messages for context
  const history = db.select().from(messages)
    .where(eq(messages.conversationId, conversationId))
    .all()
    .slice(-10);

  // Search knowledge base (simple keyword match)
  const words = userMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  let knowledgeContext = "";
  if (words.length > 0) {
    const chunks = db.select().from(knowledgeChunks)
      .where(eq(knowledgeChunks.botId, botId))
      .all();
    const relevant = chunks
      .filter(c => words.some(w => c.content.toLowerCase().includes(w)))
      .slice(0, 3)
      .map(c => c.content)
      .join("\n---\n");
    if (relevant) knowledgeContext = `\n\nBase de conhecimento relevante:\n${relevant}`;
  }

  const systemPrompt = bot.aiSystemPrompt ||
    `Você é ${bot.name}, assistente virtual de ${bot.businessName}. Responda de forma ${bot.tone === "formal" ? "formal e profissional" : "amigável e simpática"}. Seja conciso e útil.`;

  const handoffTriggers = (bot.handoffTriggers ?? []) as string[];
  const handoffLine = handoffTriggers.length > 0
    ? `\nSe o cliente mencionar: ${handoffTriggers.join(", ")} — responda normalmente mas inclua exatamente "[HANDOFF]" no final da sua resposta.`
    : "";

  const openai = getOpenAI();
  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${systemPrompt}${knowledgeContext}${handoffLine}\n\nResponda sempre em português brasileiro.`,
    },
    ...history.map(m => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: chatMessages,
    max_tokens: 500,
    temperature: 0.7,
  });

  const reply = completion.choices[0]?.message?.content ?? "Desculpe, não entendi. Pode repetir?";
  const isHandoff = reply.includes("[HANDOFF]");
  const cleanReply = reply.replace("[HANDOFF]", "").trim();

  return { reply: cleanReply, isHandoff };
}
