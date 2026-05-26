import { router, adminProcedure } from "../trpc.js";
import { getDb } from "../db.js";
import { users, workspaces, messages, conversations, bots } from "../../drizzle/schema.js";

export const adminRouter = router({
  listWorkspaces: adminProcedure.query(() => {
    const db = getDb();
    return db.select().from(workspaces).all();
  }),

  listUsers: adminProcedure.query(() => {
    const db = getDb();
    return db.select().from(users).all();
  }),

  getStats: adminProcedure.query(() => {
    const db = getDb();
    return {
      totalUsers: db.select().from(users).all().length,
      totalWorkspaces: db.select().from(workspaces).all().length,
      totalBots: db.select().from(bots).all().length,
      totalMessages: db.select().from(messages).all().length,
      totalConversations: db.select().from(conversations).all().length,
    };
  }),
});
