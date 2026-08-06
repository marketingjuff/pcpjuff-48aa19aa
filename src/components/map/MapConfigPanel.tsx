import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppList, useAppListMutations } from "@/lib/app-lists";
import { useKgPorPeca, useCorAcabamentos, corComAcabamento } from "@/lib/map";
import { REFACAO_CORES } from "@/lib/pedidos";

const SEM_ACABAMENTO = "__none__";

export function MapConfigPanel() {
  return (
    <div className="space-y-6">
      <KgPorPecaCard />
      <ListaCard kind="map_malharia" titulo="Malharias" placeholder="Ex.: Mavelo" />
      <ListaCard kind="map_acabamento" titulo="Acabamentos" placeholder="Ex.: ACAB5" />
      <CoresAcabamentoCard />
    </div>
  );
}

function CoresAcabamentoCard() {
  const { mapa, save } = useCorAcabamentos();
  const { names: acabamentos } = useAppList("map_acabamento");

  async function handleChange(cor: string, valor: string) {
    const next = { ...mapa };
    if (valor === SEM_ACABAMENTO) delete next[cor];
    else next[cor] = valor;
    try { await save.mutateAsync(next); } catch { /* toast já emitido */ }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Acabamento por cor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Define o sufixo de acabamento (ex.: <b>amarelo-ACAB3</b>) usado ao selecionar cores na Tinturaria.
          <br />Só afeta <b>novas programações</b>. Registros já gravados permanecem inalterados.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Cor</TableHead>
              <TableHead className="w-56">Acabamento</TableHead>
              <TableHead>Prévia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {REFACAO_CORES.map((c) => {
              const current = mapa?.[c.nome] ?? SEM_ACABAMENTO;
              return (
                <TableRow key={c.nome}>
                  <TableCell>
                    <span
                      className="inline-block h-5 w-5 rounded-full border border-border"
                      style={{ backgroundColor: c.hex }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>
                    <Select value={current} onValueChange={(v) => handleChange(c.nome, v)} disabled={save.isPending}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM_ACABAMENTO}>— sem acabamento</SelectItem>
                        {acabamentos.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">{corComAcabamento(c.nome, mapa)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function KgPorPecaCard() {
  const { kgPorPeca, save } = useKgPorPeca();
  const [v, setV] = useState<string>(String(kgPorPeca));
  useEffect(() => { setV(String(kgPorPeca)); }, [kgPorPeca]);
  async function handleSave() {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) { toast.error("Informe um valor maior que zero."); return; }
    await save.mutateAsync(n);
  }
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Kg por peça (padrão da tinturaria)</CardTitle></CardHeader>
      <CardContent className="flex items-end gap-2">
        <div className="w-40">
          <Input type="number" step="0.01" min="0.01" value={v} onChange={(e) => setV(e.target.value)} />
        </div>
        <Button size="sm" onClick={handleSave} disabled={save.isPending}>Salvar</Button>
        <div className="text-xs text-muted-foreground ml-2">
          Usado para pré-preencher <b>kg enviados</b> (peças × kg/peça) e para estimar peças da quebra.
        </div>
      </CardContent>
    </Card>
  );
}
