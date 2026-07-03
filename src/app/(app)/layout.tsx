import { AppShell } from "@/components/shared/app-shell";
import { OfflineProvider } from "@/components/offline/offline-provider";
import { KeepScreenAwake } from "@/components/shared/keep-screen-awake";
import { getLogoUrl, getBrand, requireCurrentUser, userDisplayName } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();
  const [logoUrl, brand] = await Promise.all([getLogoUrl(), getBrand()]);
  return (
    <AppShell
      username={user.username}
      role={user.role}
      displayName={userDisplayName(user)}
      logoUrl={logoUrl}
      appBackgroundUrl={brand.appBackgroundUrl ?? brand.backgroundUrl}
      surfaceOpacity={brand.surfaceOpacity}
    >
      <OfflineProvider />
      <KeepScreenAwake />
      {children}
    </AppShell>
  );
}
