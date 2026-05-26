import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

export function getTRPCClient() {
  const token = localStorage.getItem("atendeai_token");
  const wsId = localStorage.getItem("atendeai_wsid");
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/trpc",
        headers() {
          const h: Record<string, string> = {};
          if (token) h["Authorization"] = `Bearer ${token}`;
          if (wsId) h["x-workspace-id"] = wsId;
          return h;
        },
      }),
    ],
  });
}
