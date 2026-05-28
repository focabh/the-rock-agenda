import { AppShell } from "@/components/shared/app-shell";
import { getLogoUrl, requireCurrentUser, userDisplayName } from "@/lib/auth";

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
      displayName={userDisplayName(user)}
      logoUrl={logoUrl}
    >
      {children}
    </AppShell>
  );
}
