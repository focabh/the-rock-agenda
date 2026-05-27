import type { Metadata } from "next";
import { InstallGuide } from "@/components/install-guide";

export const metadata: Metadata = {
  title: "Instalar o app — The Rock",
  description:
    "Como instalar o app da banda The Rock no celular e ativar as notificações.",
};

export default function InstalarPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <InstallGuide />
    </main>
  );
}
