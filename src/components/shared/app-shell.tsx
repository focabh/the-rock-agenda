"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { SidebarNav } from "./sidebar-nav";
import { logoutAction } from "@/app/(auth)/actions";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 px-4 py-5">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-md ring-1 ring-border bg-[#0F1A3A]">
        <Image
          src="/the-rock-logo.png"
          alt="The Rock"
          fill
          sizes="48px"
          className="object-contain"
          priority
        />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-wide">The Rock</span>
        <span className="text-[10px] uppercase text-muted-foreground tracking-widest">
          Operações
        </span>
      </div>
    </Link>
  );
}

type SidebarProps = {
  username?: string;
  role?: string;
  memberName?: string | null;
  onNavigate?: () => void;
};

function SidebarContent({ username, role, memberName, onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <Brand />
      <Separator />
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <Separator />
      <div className="p-3 flex items-center justify-between gap-2">
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {role === "admin" ? "Admin" : "Músico"}
          </span>
          <span className="text-sm truncate font-medium">
            {memberName ?? username ?? "—"}
          </span>
          {memberName && username && (
            <span className="text-[10px] text-muted-foreground truncate">
              @{username}
            </span>
          )}
        </div>
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            title="Sair"
            className="shrink-0"
          >
            <LogOut className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

export function AppShell({
  username,
  role,
  memberName,
  children,
}: {
  username?: string;
  role?: string;
  memberName?: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <SidebarContent username={username} role={role} memberName={memberName} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center gap-3 border-b border-border px-4 py-3 bg-card">
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
                memberName={memberName}
                onNavigate={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="relative size-8 overflow-hidden rounded-md ring-1 ring-border bg-[#0F1A3A]">
              <Image
                src="/the-rock-logo.png"
                alt="The Rock"
                fill
                sizes="32px"
                className="object-contain"
              />
            </div>
            <span className="text-sm font-semibold">The Rock</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
