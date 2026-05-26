import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

export const aiRouter = router({
  chat: protectedProcedure
    .input(z.object({ message: z.string(), botId: z.number().optional() }))
    .mutation(async ({ input }) => {
      // Placeholder for AI integration
      return { reply: `Recebi: "${input.message}". Esta funcionalidade requer integração com uma API de IA.` };
    }),
});
