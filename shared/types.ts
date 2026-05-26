export * from "../drizzle/schema";
export * from "./plans";

export type ApiResponse<T> = {
  data: T;
  error?: never;
} | {
  data?: never;
  error: string;
};
