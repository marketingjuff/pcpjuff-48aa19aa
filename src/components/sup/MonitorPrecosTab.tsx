import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlteracoesPrecoTab } from "@/components/sup/AlteracoesPrecoTab";
import { ComparativoFornecedoresTab } from "@/components/sup/ComparativoFornecedoresTab";
import { EconomiaTrocaTab } from "@/components/sup/EconomiaTrocaTab";
import { OscilacaoPrecoTab } from "@/components/sup/OscilacaoPrecoTab";

/** Container do Monitor de Preços: período compartilhado entre as sub-abas. */
export function MonitorPrecosTab() {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [sub, setSub] = useState("registro");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-36">
          <Label className="text-xs">De</Label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9" />
        </div>
        <div className="w-36">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9" />
        </div>
        <div className="text-[11px] text-muted-foreground pb-2">
          O período vale para todas as sub-abas do monitor.
        </div>
      </div>

      <Tabs value={sub} onValueChange={setSub}>
        <TabsList className="flex flex-wrap mb-4">
          <TabsTrigger value="registro">Registro de alterações</TabsTrigger>
          <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
          <TabsTrigger value="economia">Economia por troca</TabsTrigger>
          <TabsTrigger value="oscilacao">Oscilação de preço</TabsTrigger>
        </TabsList>

        <TabsContent value="registro" forceMount hidden={sub !== "registro"}>
          <AlteracoesPrecoTab de={de} ate={ate} />
        </TabsContent>
        <TabsContent value="comparativo" forceMount hidden={sub !== "comparativo"}>
          <ComparativoFornecedoresTab />
        </TabsContent>
        <TabsContent value="economia" forceMount hidden={sub !== "economia"}>
          <EconomiaTrocaTab de={de} ate={ate} />
        </TabsContent>
        <TabsContent value="oscilacao" forceMount hidden={sub !== "oscilacao"}>
          <OscilacaoPrecoTab de={de} ate={ate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
