import { router } from "./trpc.js";
import { authRouter } from "./routers/auth.js";
import { workspaceRouter } from "./routers/workspace.js";
import { botsRouter } from "./routers/bots.js";
import { whatsappRouter } from "./routers/whatsapp.js";
import { flowsRouter } from "./routers/flows.js";
import { conversationsRouter } from "./routers/conversations.js";
import { knowledgeRouter } from "./routers/knowledge.js";
import { analyticsRouter } from "./routers/analytics.js";
import { dashboardRouter } from "./routers/dashboard.js";
import { billingRouter } from "./routers/billing.js";
import { adminRouter } from "./routers/admin.js";
import { aiRouter } from "./routers/ai.js";

export const appRouter = router({
  auth: authRouter,
  workspace: workspaceRouter,
  bots: botsRouter,
  whatsapp: whatsappRouter,
  flows: flowsRouter,
  conversations: conversationsRouter,
  knowledge: knowledgeRouter,
  analytics: analyticsRouter,
  dashboard: dashboardRouter,
  billing: billingRouter,
  admin: adminRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
