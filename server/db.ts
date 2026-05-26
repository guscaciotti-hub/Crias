import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../drizzle/schema.js";
import * as relations from "../drizzle/relations.js";
import { sql } from "drizzle-orm";

const DB_PATH = process.env.DB_PATH || "./atendeai.db";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  _db = drizzle(sqlite, { schema: { ...schema, ...relations } });
  initSchema();
  return _db;
}

function initSchema() {
  const db = _db!;
  // Create tables if not exist (auto migration for dev)
  db.run(sql`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    open_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    plan TEXT NOT NULL DEFAULT 'trial',
    onboarding_completed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS workspace_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT NOT NULL DEFAULT 'member',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    business_name TEXT NOT NULL,
    business_description TEXT,
    niche TEXT NOT NULL DEFAULT 'custom',
    persona TEXT,
    tone TEXT NOT NULL DEFAULT 'friendly',
    system_prompt TEXT,
    welcome_message TEXT,
    off_hours_message TEXT,
    handoff_triggers TEXT NOT NULL DEFAULT '[]',
    forbidden_topics TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS whatsapp_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER NOT NULL REFERENCES bots(id),
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    instance_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected',
    phone_number TEXT,
    last_qr_at INTEGER,
    connected_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER NOT NULL REFERENCES bots(id),
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    phone TEXT NOT NULL,
    name TEXT,
    first_seen_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    last_seen_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    message_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER NOT NULL REFERENCES bots(id),
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    contact_id INTEGER NOT NULL REFERENCES contacts(id),
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS knowledge_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    bot_id INTEGER NOT NULL REFERENCES bots(id),
    type TEXT NOT NULL DEFAULT 'text',
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'indexed',
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL REFERENCES knowledge_documents(id),
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    bot_id INTEGER NOT NULL REFERENCES bots(id),
    content TEXT NOT NULL,
    embedding TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS flow_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER NOT NULL REFERENCES bots(id),
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    type TEXT NOT NULL,
    content TEXT,
    metadata TEXT,
    pos_x INTEGER NOT NULL DEFAULT 0,
    pos_y INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS flow_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER NOT NULL REFERENCES bots(id),
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    source_node_id INTEGER NOT NULL REFERENCES flow_nodes(id),
    target_node_id INTEGER NOT NULL REFERENCES flow_nodes(id),
    label TEXT,
    condition TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS auto_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER NOT NULL REFERENCES bots(id),
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS conversation_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL UNIQUE REFERENCES conversations(id),
    bot_id INTEGER NOT NULL REFERENCES bots(id),
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    current_node_id INTEGER,
    collected_data TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);
}

export type Db = ReturnType<typeof getDb>;
