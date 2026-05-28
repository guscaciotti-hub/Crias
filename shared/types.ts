export * from "../drizzle/schema.js";
export * from "./plans.js";

export type ApiResponse<T> = {
  data: T;
  error?: never;
} | {
  data?: never;
  error: string;
};
