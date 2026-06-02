import type { Metadata } from "next";
import { DemoTour } from "@/components/demo/demo-tour";

export const metadata: Metadata = {
  title: "StageBoss — demonstração",
  description:
    "Experimente o StageBoss: repertório, setlists, teleprompter sincronizado, agenda e flyer. Dados fictícios — sinta o gostinho do que ele faz pela sua banda.",
};

// Página pública (fora do grupo (app), sem login) — só dados fictícios.
export default function DemoPage() {
  return <DemoTour />;
}
