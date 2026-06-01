"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarRange,
  Users,
  Megaphone,
  Wallet,
  BookOpen,
  ChevronDown,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Sub = { href: string; label: string; adminOnly?: boolean };
type Group = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Sub[];
};

const GROUPS: Group[] = [
  {
    id: "agenda",
    label: "Agenda",
    icon: CalendarRange,
    items: [
      { href: "/agenda", label: "Calendário" },
      { href: "/shows", label: "Shows" },
      { href: "/ensaios", label: "Ensaios" },
      { href: "/cadastros", label: "Convites", adminOnly: true },
    ],
  },
  {
    id: "banda",
    label: "A Banda",
    icon: Users,
    items: [
      { href: "/repertorio", label: "Repertório" },
      { href: "/equipamentos", label: "Equipamentos" },
      { href: "/banda", label: "Membros" },
      { href: "/posicoes", label: "Posições", adminOnly: true },
      { href: "/sobre", label: "Sobre a banda" },
    ],
  },
  {
    id: "divulgacao",
    label: "Divulgação & Eventos",
    icon: Megaphone,
    items: [
      { href: "/casas", label: "Casas / Locais" },
      { href: "/divulgacao", label: "Material da banda" },
      { href: "/contratantes", label: "Divulgação" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: Wallet,
    items: [
      { href: "/financeiro", label: "Visão geral" },
      { href: "/pagamentos", label: "Cachês" },
      { href: "/gastos", label: "Gastos", adminOnly: true },
    ],
  },
];

export function SidebarNav({
  onNavigate,
  isAdmin = false,
}: {
  onNavigate?: () => void;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Abre por padrão o grupo que contém a rota atual.
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    for (const g of GROUPS) o[g.id] = g.items.some((i) => isActive(i.href));
    return o;
  });

  const linkCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
    );

  return (
    <nav className="flex h-full flex-col gap-1 px-2">
      {/* Painel — link direto */}
      <Link href="/" onClick={onNavigate} className={linkCls(pathname === "/")}>
        <LayoutDashboard className="size-5 shrink-0" />
        <span>Painel</span>
      </Link>

      {/* Modo Show — tela única do show (offline) */}
      <Link
        href="/modo-show"
        onClick={onNavigate}
        className={cn(linkCls(isActive("/modo-show")), "text-primary hover:text-primary")}
      >
        <Radio className="size-5 shrink-0" />
        <span className="font-medium">Modo Show</span>
      </Link>

      {/* Grupos colapsáveis */}
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => !i.adminOnly || isAdmin);
        if (items.length === 0) return null;
        const Icon = g.icon;
        const aberto = open[g.id] ?? false;
        const temAtivo = items.some((i) => isActive(i.href));
        return (
          <div key={g.id}>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                temAtivo
                  ? "text-sidebar-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="flex-1 text-left">{g.label}</span>
              <ChevronDown className={cn("size-4 transition-transform", aberto && "rotate-180")} />
            </button>
            {aberto && (
              <div className="mt-0.5 flex flex-col gap-0.5 pb-1">
                {items.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    onClick={onNavigate}
                    className={cn(linkCls(isActive(i.href)), "py-1.5 pl-6")}
                  >
                    <span>{i.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Como usar — rodapé, discreto */}
      <Link
        href="/guia"
        onClick={onNavigate}
        className={cn(linkCls(isActive("/guia")), "mt-auto opacity-60 hover:opacity-100")}
      >
        <BookOpen className="size-5 shrink-0" />
        <span>Como usar</span>
      </Link>
    </nav>
  );
}
