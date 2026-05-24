import type { ActionState } from "@/lib/form";
import { fieldError } from "@/lib/form";

export function FieldError({
  state,
  name,
}: {
  state: ActionState;
  name: string;
}) {
  const err = fieldError(state, name);
  if (!err) return null;
  return <p className="text-xs text-destructive mt-1">{err}</p>;
}
