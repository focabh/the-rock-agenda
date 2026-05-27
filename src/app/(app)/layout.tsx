import { AppShell } from "@/components/shared/app-shell";
import { getLogoUrl, requireCurrentUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();
  const logoUrl = await getLogoUrl();
  return (
    <AppShell
      username={user.username}
      role={user.role}
      memberName={user.member?.nome ?? null}
      logoUrl={logoUrl}
    >
      {children}
    </AppShell>
  );
}
