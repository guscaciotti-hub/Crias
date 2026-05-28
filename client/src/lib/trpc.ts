import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/trpc",
        headers() {
          // Read fresh on every request so login/logout works correctly
          const token = localStorage.getItem("atendeai_token");
          const wsId = localStorage.getItem("atendeai_wsid");
          const h: Record<string, string> = {};
          if (token) h["Authorization"] = `Bearer ${token}`;
          if (wsId) h["x-workspace-id"] = wsId;
          return h;
        },
      }),
    ],
  });
}
