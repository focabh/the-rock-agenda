import { AppShell } from "@/components/shared/app-shell";
import { requireCurrentUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();
  return (
    <AppShell
      username={user.username}
      role={user.role}
      memberName={user.member?.nome ?? null}
    >
      {children}
    </AppShell>
  );
}
