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
  posShow,
}: {
  resumo: React.ReactNode;
  setlist: React.ReactNode;
  posShow?: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="resumo" className="gap-4">
      <TabsList variant="line" className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="resumo">Resumo</TabsTrigger>
        <TabsTrigger value="setlist">Setlist</TabsTrigger>
        {posShow && <TabsTrigger value="pos-show">Pós-show</TabsTrigger>}
      </TabsList>
      <TabsContent value="resumo">{resumo}</TabsContent>
      <TabsContent value="setlist">{setlist}</TabsContent>
      {posShow && <TabsContent value="pos-show">{posShow}</TabsContent>}
    </Tabs>
  );
}
