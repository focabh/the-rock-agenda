"use client";

import { useRouter } from "next/navigation";
import { RehearsalForm } from "@/components/agenda/rehearsal-manager";
import type { Rehearsal } from "@/db/schema";

export function RehearsalPageForm({
  rehearsal,
  redirectTo,
  shows = [],
}: {
  rehearsal?: Rehearsal;
  redirectTo: string;
  shows?: { id: string; label: string }[];
}) {
  const router = useRouter();
  return (
    <RehearsalForm
      rehearsal={rehearsal}
      shows={shows}
      onDone={() => {
        router.push(redirectTo);
        router.refresh();
      }}
    />
  );
}
