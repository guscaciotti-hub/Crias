import { relations } from "drizzle-orm";
import {
  users, workspaces, workspaceMembers, bots, whatsappInstances,
  contacts, conversations, messages, knowledgeDocuments, knowledgeChunks,
  flowNodes, flowEdges, autoMessages, conversationStates, sessions
} from "./schema.js";

export const usersRelations = relations(users, ({ many }) => ({
  workspaces: many(workspaces),
  workspaceMembers: many(workspaceMembers),
  sessions: many(sessions),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  members: many(workspaceMembers),
  bots: many(bots),
}));

export const botsRelations = relations(bots, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [bots.workspaceId], references: [workspaces.id] }),
  whatsappInstance: one(whatsappInstances, { fields: [bots.id], references: [whatsappInstances.botId] }),
  contacts: many(contacts),
  conversations: many(conversations),
  knowledgeDocuments: many(knowledgeDocuments),
  flowNodes: many(flowNodes),
  flowEdges: many(flowEdges),
  autoMessages: many(autoMessages),
}));
