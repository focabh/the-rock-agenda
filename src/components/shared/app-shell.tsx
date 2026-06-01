"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, LogOut, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { SidebarNav } from "./sidebar-nav";
import { logoutAction } from "@/app/(auth)/actions";

function Brand({ logoUrl }: { logoUrl: string }) {
  return (
    <Link href="/" className="flex items-center gap-3 px-4 py-5">
      <div className="size-12 shrink-0 overflow-hidden rounded-md ring-1 ring-border bg-[#0F1A3A] flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="The Rock" className="size-full object-contain" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-wide">The Rock</span>
        <span className="text-[10px] uppercase text-amber-400 tracking-widest font-semibold">
          StageBoss
        </span>
      </div>
    </Link>
  );
}

type SidebarProps = {
  username?: string;
  role?: string;
  displayName?: string | null;
  logoUrl: string;
  onNavigate?: () => void;
};

function SidebarContent({ username, role, displayName, logoUrl, onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <Brand logoUrl={logoUrl} />
      <Separator />
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav onNavigate={onNavigate} isAdmin={role === "admin"} />
      </div>
      <Separator />
      <div className="p-3 flex items-center justify-between gap-2">
        <Link
          href="/conta"
          onClick={onNavigate}
          className="flex flex-col leading-tight min-w-0 hover:opacity-80"
          title="Minha conta"
        >
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {role === "admin" ? "Admin" : "Músico"}
          </span>
          <span className="text-sm truncate font-medium">
            {displayName ?? username ?? "—"}
          </span>
          {displayName && username && displayName !== username && (
            <span className="text-[10px] text-muted-foreground truncate">
              @{username}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            render={<Link href="/conta" onClick={onNavigate} />}
            variant="ghost"
            size="icon"
            title="Conta"
          >
            <UserCog className="size-4" />
          </Button>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="icon" title="Sair">
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  username,
  role,
  displayName,
  logoUrl,
  appBackgroundUrl,
  children,
}: {
  username?: string;
  role?: string;
  displayName?: string | null;
  logoUrl: string;
  appBackgroundUrl?: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Fundo geral do app (atrás de tudo, sem alterar o layout). Overlay escuro
          pra manter cards/textos legíveis. */}
      {appBackgroundUrl && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(9,9,11,0.86), rgba(9,9,11,0.86)), url(${appBackgroundUrl})`,
            backgroundAttachment: "fixed",
          }}
        />
      )}
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar print:hidden">
        <SidebarContent
          username={username}
          role={role}
          displayName={displayName}
          logoUrl={logoUrl}
        />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center gap-3 border-b border-border px-4 py-3 bg-card print:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar">
              <SheetHeader className="sr-only">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <SidebarContent
                username={username}
                role={role}
                displayName={displayName}
                logoUrl={logoUrl}
                onNavigate={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="size-8 overflow-hidden rounded-md ring-1 ring-border bg-[#0F1A3A] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="The Rock" className="size-full object-contain" />
            </div>
            <span className="text-sm font-semibold">The Rock</span>
          </div>
        </header>

        {/* Scroller principal. overflow-x-hidden + scrollbar-gutter:stable
            garantem que (a) nada estoura na horizontal e (b) abrir/fechar um
            diálogo não "rouba" a margem (sem pulo de layout). O container
            interno garante margem e largura máxima em TODAS as telas. */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="mx-auto w-full min-w-0 max-w-screen-2xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
