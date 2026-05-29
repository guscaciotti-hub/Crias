import {
  sqliteTable, text, integer, real, blob, unique, index
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const now = sql`(strftime('%s','now'))`;

// ────────────────────────────── users ──────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("open_id").unique().notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(true),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── workspaces ──────────────────────────
export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  plan: text("plan", { enum: ["trial", "starter", "pro", "business"] }).notNull().default("trial"),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── workspace members ───────────────────
export const workspaceMembers = sqliteTable("workspace_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  userId: integer("user_id").notNull().references(() => users.id),
  role: text("role", { enum: ["owner", "admin", "member"] }).notNull().default("member"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── bots ────────────────────────────────
export const bots = sqliteTable("bots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  businessName: text("business_name").notNull(),
  businessDescription: text("business_description"),
  niche: text("niche").notNull().default("custom"),
  persona: text("persona"),
  tone: text("tone", { enum: ["formal", "friendly", "professional", "casual"] }).notNull().default("friendly"),
  systemPrompt: text("system_prompt"),
  welcomeMessage: text("welcome_message"),
  offHoursMessage: text("off_hours_message"),
  agentMode: text("agent_mode", { enum: ["flow", "ai"] }).notNull().default("flow"),
  aiSystemPrompt: text("ai_system_prompt"),
  handoffTriggers: text("handoff_triggers", { mode: "json" }).$type<string[]>().notNull().default([]),
  forbiddenTopics: text("forbidden_topics", { mode: "json" }).$type<string[]>().notNull().default([]),
  alertNumbers: text("alert_numbers", { mode: "json" }).$type<string[]>().notNull().default([]),
  responseDelay: integer("response_delay").notNull().default(3), // segundos antes de responder (2-30)
  status: text("status", { enum: ["active", "inactive", "disconnected"] }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── whatsapp instances ──────────────────
export const whatsappInstances = sqliteTable("whatsapp_instances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  botId: integer("bot_id").notNull().references(() => bots.id),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  instanceName: text("instance_name").notNull(),
  status: text("status", { enum: ["connected", "disconnected", "qr_pending", "error"] }).notNull().default("disconnected"),
  phoneNumber: text("phone_number"),
  lastQrAt: integer("last_qr_at", { mode: "timestamp" }),
  connectedAt: integer("connected_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── contacts ────────────────────────────
export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  botId: integer("bot_id").notNull().references(() => bots.id),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  phone: text("phone").notNull(),
  name: text("name"),
  firstSeenAt: integer("first_seen_at", { mode: "timestamp" }).notNull().default(now),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull().default(now),
  messageCount: integer("message_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── conversations ───────────────────────
export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  botId: integer("bot_id").notNull().references(() => bots.id),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  contactId: integer("contact_id").notNull().references(() => contacts.id),
  status: text("status", { enum: ["active", "handoff", "closed"] }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── messages ────────────────────────────
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  role: text("role", { enum: ["user", "bot", "human"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── knowledge documents ─────────────────
export const knowledgeDocuments = sqliteTable("knowledge_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  botId: integer("bot_id").notNull().references(() => bots.id),
  type: text("type", { enum: ["faq", "document", "url", "text"] }).notNull().default("text"),
  name: text("name").notNull(),
  content: text("content").notNull(),
  status: text("status", { enum: ["pending", "indexing", "indexed", "error"] }).notNull().default("indexed"),
  chunkCount: integer("chunk_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── knowledge chunks ────────────────────
export const knowledgeChunks = sqliteTable("knowledge_chunks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("document_id").notNull().references(() => knowledgeDocuments.id),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  botId: integer("bot_id").notNull().references(() => bots.id),
  content: text("content").notNull(),
  embedding: text("embedding", { mode: "json" }).$type<number[]>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── flow nodes ──────────────────────────
export type FlowNodeMetadata = {
  options?: { label: string; value: string; emoji?: string }[];
  saveAs?: string;
  keyword?: string;
  delaySeconds?: number;
  handoffMessage?: string;
};

export const flowNodes = sqliteTable("flow_nodes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  botId: integer("bot_id").notNull().references(() => bots.id),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  type: text("type", { enum: ["start", "message", "menu", "input", "condition", "handoff", "end"] }).notNull(),
  content: text("content"),
  metadata: text("metadata", { mode: "json" }).$type<FlowNodeMetadata>(),
  posX: integer("pos_x").notNull().default(0),
  posY: integer("pos_y").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── flow edges ──────────────────────────
export const flowEdges = sqliteTable("flow_edges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  botId: integer("bot_id").notNull().references(() => bots.id),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  sourceNodeId: integer("source_node_id").notNull().references(() => flowNodes.id),
  targetNodeId: integer("target_node_id").notNull().references(() => flowNodes.id),
  label: text("label"),
  condition: text("condition"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── auto messages ───────────────────────
export const autoMessages = sqliteTable("auto_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  botId: integer("bot_id").notNull().references(() => bots.id),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  type: text("type", { enum: ["welcome", "off_hours", "handoff", "goodbye", "fallback", "delay_warning"] }).notNull(),
  content: text("content").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── conversation states ─────────────────
export const conversationStates = sqliteTable("conversation_states", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").notNull().unique().references(() => conversations.id),
  botId: integer("bot_id").notNull().references(() => bots.id),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  currentNodeId: integer("current_node_id"),
  collectedData: text("collected_data", { mode: "json" }).$type<Record<string, string>>(),
  attempts: integer("attempts").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── AI usage tracking ───────────────────
export const aiUsage = sqliteTable("ai_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  botId: integer("bot_id").notNull().references(() => bots.id),
  conversationId: integer("conversation_id"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── sessions (auth) ─────────────────────
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

// ────────────────────────────── email tokens ────────────────────────
export const emailTokens = sqliteTable("email_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  code: text("code").notNull(),
  type: text("type", { enum: ["verify_email", "reset_password"] }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});
