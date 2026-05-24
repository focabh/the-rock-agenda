"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export function ShowDetailTabs({
  resumo,
  setlist,
  checklist,
  avaliacao,
  proposta,
}: {
  resumo: React.ReactNode;
  setlist: React.ReactNode;
  checklist: React.ReactNode;
  avaliacao: React.ReactNode;
  proposta: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="resumo" className="gap-4">
      <TabsList variant="line" className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="resumo">Resumo</TabsTrigger>
        <TabsTrigger value="setlist">Setlist</TabsTrigger>
        <TabsTrigger value="checklist">Checklists</TabsTrigger>
        <TabsTrigger value="avaliacao">Avaliação</TabsTrigger>
        <TabsTrigger value="proposta">Proposta</TabsTrigger>
      </TabsList>
      <TabsContent value="resumo">{resumo}</TabsContent>
      <TabsContent value="setlist">{setlist}</TabsContent>
      <TabsContent value="checklist">{checklist}</TabsContent>
      <TabsContent value="avaliacao">{avaliacao}</TabsContent>
      <TabsContent value="proposta">{proposta}</TabsContent>
    </Tabs>
  );
}
