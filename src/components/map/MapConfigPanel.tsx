import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAppList, useAppListMutations, type AppListKind } from "@/lib/app-lists";
import { useKgPorPeca, useCorAcabamentos, corComAcabamento } from "@/lib/map";
import { REFACAO_CORES } from "@/lib/pedidos";

const SEM_ACABAMENTO = "__none__";

export function MapConfigPanel() {
  return (
    <div className="space-y-6">
      <KgPorPecaCard />
      <ListaCard kind="map_fio_fornecedor" titulo="Fornecedores de fio" placeholder="Ex.: Ventuno" />
      <ListaCard kind="map_malharia" titulo="Malharias" placeholder="Ex.: Mavelo" />
      <ListaCard kind="map_tinturaria" titulo="Tinturarias" placeholder="Ex.: Martêxtil" />
      <ListaCard kind="map_acabamento" titulo="Acabamentos" placeholder="Ex.: ACAB5" />
      <CoresAcabamentoCard />
      <AcessoMapCard />
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

function ListaCard({ kind, titulo, placeholder }: { kind: AppListKind; titulo: string; placeholder: string }) {
  const { items } = useAppList(kind);
  const { add, remove } = useAppListMutations(kind);
  const [novo, setNovo] = useState("");
  async function handleAdd() {
    const v = novo.trim();
    if (!v) { toast.error("Digite o nome."); return; }
    try { await add.mutateAsync(v); setNovo(""); toast.success("Adicionado."); }
    catch (e: any) { toast.error(e?.message ?? "Erro ao adicionar."); }
  }
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder={placeholder}
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            disabled={add.isPending}
          />
          <Button size="sm" onClick={handleAdd} disabled={add.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={2} className="text-muted-foreground">Nenhum item cadastrado.</TableCell></TableRow>
            ) : items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>{it.nome}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(it.id)} title="Remover">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AcessoMapCard() {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Controle de acesso ao MAP</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        <p>As configurações do MAP estão liberadas para <span className="font-medium text-foreground">administradores</span> e <span className="font-medium text-foreground">gestores com acesso ao MAP</span>.</p>
        <p>Para conceder o acesso a um gestor, use a aba <b>Usuários</b> em Configurações do PCP e marque a área <b>MAP — Matéria Prima</b>.</p>
      </CardContent>
    </Card>
  );
}
