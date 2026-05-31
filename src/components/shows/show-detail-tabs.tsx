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
}: {
  resumo: React.ReactNode;
  setlist: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="resumo" className="gap-4">
      <TabsList variant="line" className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="resumo">Resumo</TabsTrigger>
        <TabsTrigger value="setlist">Setlist</TabsTrigger>
      </TabsList>
      <TabsContent value="resumo">{resumo}</TabsContent>
      <TabsContent value="setlist">{setlist}</TabsContent>
    </Tabs>
  );
}
