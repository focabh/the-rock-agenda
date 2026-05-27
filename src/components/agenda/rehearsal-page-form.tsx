"use client";

import { useRouter } from "next/navigation";
import { RehearsalForm } from "@/components/agenda/rehearsal-manager";
import type { Rehearsal } from "@/db/schema";

export function RehearsalPageForm({
  rehearsal,
  redirectTo,
}: {
  rehearsal?: Rehearsal;
  redirectTo: string;
}) {
  const router = useRouter();
  return (
    <RehearsalForm
      rehearsal={rehearsal}
      onDone={() => {
        router.push(redirectTo);
        router.refresh();
      }}
    />
  );
}
