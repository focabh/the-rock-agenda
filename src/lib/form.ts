import { z } from "zod";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | null;

export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData
): { ok: true; data: z.infer<T> } | { ok: false; state: ActionState } {
  const entries: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    // empty strings -> undefined para optional/nullable funcionarem
    entries[k] = v === "" ? undefined : v;
  }
  const result = schema.safeParse(entries);
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      (fieldErrors[key] ||= []).push(issue.message);
    }
    return { ok: false, state: { fieldErrors, error: "Verifique os campos." } };
  }
  return { ok: true, data: result.data };
}

export function fieldError(state: ActionState, name: string): string | undefined {
  return state?.fieldErrors?.[name]?.[0];
}
