"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Apple,
  Smartphone,
  Share,
  Plus,
  Bell,
  CheckCircle2,
  LogIn,
  Download,
  MoreVertical,
  ArrowRight,
  UserPlus,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Platform = "ios" | "android";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Step = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc?: React.ReactNode;
};

const STEPS: Record<Platform, Step[]> = {
  ios: [
    {
      icon: LogIn,
      title: "Abra no Safari e faça login",
      desc: "Tem que ser pelo Safari. Entre com seu usuário e senha.",
    },
    {
      icon: Share,
      title: "Toque em Compartilhar",
      desc: "O botão do quadradinho com a seta pra cima, na barra de baixo.",
    },
    {
      icon: Plus,
      title: 'Toque em "Adicionar à Tela de Início"',
      desc: "Role um pouco se não achar. Depois confirme em Adicionar.",
    },
    {
      icon: Smartphone,
      title: "Abra pelo ícone novo",
      desc: "Feche o Safari e abra o The Rock pelo ícone na sua tela inicial.",
    },
    {
      icon: Bell,
      title: "Ative as notificações",
      desc: "Dentro do app: Conta → Ativar notificações → Permitir.",
    },
    {
      icon: CheckCircle2,
      title: "Toque em Enviar teste",
      desc: "Se a notificação chegar, está tudo pronto! 🤘",
    },
  ],
  android: [
    {
      icon: LogIn,
      title: "Abra no Chrome e faça login",
      desc: "Entre com seu usuário e senha.",
    },
    {
      icon: Download,
      title: 'Toque em "Instalar app"',
      desc: (
        <>
          Aparece um aviso pra instalar. Se não aparecer, abra o menu{" "}
          <MoreVertical className="inline size-4" /> (canto de cima) e escolha
          “Instalar app”.
        </>
      ),
    },
    {
      icon: Smartphone,
      title: "Abra pelo ícone novo",
      desc: "O The Rock vai estar na sua tela inicial como um app.",
    },
    {
      icon: Bell,
      title: "Ative as notificações",
      desc: "Dentro do app: Conta → Ativar notificações → Permitir.",
    },
    {
      icon: CheckCircle2,
      title: "Toque em Enviar teste",
      desc: "Se a notificação chegar, está tudo pronto! 🤘",
    },
  ],
};

export function InstallGuide() {
  const [platform, setPlatform] = useState<Platform>("android");
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) setPlatform("ios");
    else if (/Android/.test(ua)) setPlatform("android");
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true
    );

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  const steps = STEPS[platform];

  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      {/* Hero */}
      <div className="flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt="The Rock"
          className="size-20 rounded-2xl ring-1 ring-border shadow-lg"
        />
        <h1 className="mt-4 text-2xl font-bold">Instale o app da banda</h1>
        <p className="mt-1 text-muted-foreground">
          Tenha o The Rock na tela inicial e receba os avisos de shows e ensaios
          direto no celular.
        </p>
      </div>

      {isStandalone ? (
        <div className="mt-8 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
          <p className="font-medium text-emerald-300">App já instalado! 🤘</p>
          <p className="mt-1 text-sm text-emerald-100/80">
            Agora é só ativar as notificações em Conta.
          </p>
          <Button className="mt-3" render={<Link href="/conta" />}>
            <Bell className="size-4" />
            Ir para Conta
          </Button>
        </div>
      ) : (
        <>
          {/* Fase 1 — criar conta */}
          <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Passo 1 · Crie sua conta
          </p>
          <div className="mt-2 rounded-lg border border-primary/40 bg-primary/5 p-4">
            <p className="flex items-center gap-2 font-medium">
              <UserPlus className="size-4 text-primary shrink-0" />
              Ainda não tem login?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie sua conta e escolha sua posição na banda. Depois é só esperar
              o admin liberar seu acesso.
            </p>
            <Button className="mt-3" render={<Link href="/cadastro" />}>
              <UserPlus className="size-4" />
              Criar conta
            </Button>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              Já tem login liberado? Pode pular direto pro passo 2.
            </p>
          </div>

          {/* Fase 2 — instalar */}
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Passo 2 · Instale no celular
          </p>
          {/* Seletor de plataforma */}
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-border p-1">
            <PlatformTab
              active={platform === "ios"}
              onClick={() => setPlatform("ios")}
              icon={Apple}
              label="iPhone"
            />
            <PlatformTab
              active={platform === "android"}
              onClick={() => setPlatform("android")}
              icon={Smartphone}
              label="Android"
            />
          </div>

          {/* Botão de instalação direta (quando o navegador permite) */}
          {deferred && platform === "android" && (
            <Button className="mt-4 w-full" size="lg" onClick={install}>
              <Download className="size-5" />
              Instalar agora
            </Button>
          )}

          {/* Passos */}
          <ol className="mt-6 space-y-3">
            {steps.map((s, i) => (
              <li
                key={i}
                className="flex gap-4 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-col items-center">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  {i < steps.length - 1 && (
                    <span className="mt-1 w-px flex-1 bg-border" />
                  )}
                </div>
                <div className="min-w-0 pb-1">
                  <p className="flex items-center gap-2 font-medium">
                    <s.icon className="size-4 text-primary shrink-0" />
                    {s.title}
                  </p>
                  {s.desc && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {s.desc}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="mt-8 text-center">
        <Button variant="outline" render={<Link href="/" />}>
          Abrir o The Rock
          <ArrowRight className="size-4" />
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Cada pessoa precisa ativar as notificações uma vez no próprio aparelho.
        </p>
      </div>
    </div>
  );
}

function PlatformTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-colors " +
        (active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent/50")
      }
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
