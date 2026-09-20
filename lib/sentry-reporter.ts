import * as Sentry from "@sentry/nextjs";

type SupabaseOperationType = "select" | "insert" | "update" | "delete" | "rpc" | "storage";

export function captureSupabaseError(
  encounteredError: unknown,
  contextMeta: {
    operation: SupabaseOperationType;
    targetName?: string;
    userId?: string;
    metaDetails?: Record<string, unknown>;
  }
) {
  if (!encounteredError) return;

  console.error(`[Supabase Error][${contextMeta.operation}:${contextMeta.targetName || "unknown"}]`, encounteredError);

  Sentry.withScope((scope) => {
    scope.setTag("supabase_operation", contextMeta.operation);
    if (contextMeta.targetName) {
      scope.setTag("supabase_target", contextMeta.targetName);
    }
    if (contextMeta.userId) {
      scope.setUser({ id: contextMeta.userId });
    }
    if (contextMeta.metaDetails) {
      scope.setExtras(contextMeta.metaDetails);
    }
    if (encounteredError instanceof Error) {
      Sentry.captureException(encounteredError);
      return;
    }
    const message =
      typeof encounteredError === "object" && encounteredError !== null && "message" in encounteredError
        ? String((encounteredError as { message: unknown }).message)
        : String(encounteredError);
    Sentry.captureException(new Error(`[Supabase ${contextMeta.operation}] ${message}`));
  });
}
