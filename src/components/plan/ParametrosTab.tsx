import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-role";
import {
  kgPorPeca, usePlanConfig, usePlanConfigRows, usePlanFichas, useSalvarConfig, useSalvarFicha,
  type FichaModelo,
} from "@/lib/plan";

const ROTULOS: Record<string, string> = {
  gramatura_g_por_metro: "Gramatura (g por metro)",
  largura_padrao_m: "Largura padrão (m)",
  fator_perda_encaixe: "Fator de perda do encaixe",
  semanas_seguranca: "Semanas de segurança",
  lead_time_completo_dias: "Reposição completa (dias)",
  lead_time_com_cru_dias: "Reposição com cru parado (dias)",
  lote_minimo_tinturaria_kg: "Lote mínimo da tinturaria (kg)",
  horizonte_meses_padrao: "Horizonte inicial (meses)",
};

/** Aceita vírgula ou ponto; até 3 casas decimais. */
function parseNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  return Number(t);
}
const mostra = (n: number) => String(n).replace(".", ",");

function CampoConfig({ chave, valor, descricao, podeEditar }: { chave: string; valor: number; descricao: string | null; podeEditar: boolean }) {
  const [txt, setTxt] = useState(mostra(valor));
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useSalvarConfig();
  useEffect(() => setTxt(mostra(valor)), [valor]);
  const onSalvar = async () => {
    const n = parseNum(txt);
    if (n === null) { setErro("Número inválido (até 3 casas decimais)."); return; }
    setErro(null);
    try { await salvar.mutateAsync({ chave, valor: n }); }
    catch (e: any) { setErro(e?.message ?? "Erro ao salvar"); }
  };
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{ROTULOS[chave] ?? chave}</label>
      <div className="flex gap-2">
        <Input type="text" inputMode="decimal" value={txt} disabled={!podeEditar} onChange={(e) => setTxt(e.target.value)} className="max-w-[140px]" />
        {podeEditar && <Button size="sm" onClick={onSalvar} disabled={salvar.isPending || txt === mostra(valor)}>Salvar</Button>}
      </div>
      {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}

function LinhaFicha({ f, podeEditar }: { f: FichaModelo; podeEditar: boolean }) {
  const { data: config } = usePlanConfig();
  const salvar = useSalvarFicha();
  const [v, setV] = useState({
    tamanho_referencia: f.tamanho_referencia,
    pecas_por_folha: mostra(f.pecas_por_folha),
    altura_folha_m: mostra(f.altura_folha_m),
    largura_tecido_m: mostra(f.largura_tecido_m),
  });
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => setV({
    tamanho_referencia: f.tamanho_referencia,
    pecas_por_folha: mostra(f.pecas_por_folha),
    altura_folha_m: mostra(f.altura_folha_m),
    largura_tecido_m: mostra(f.largura_tecido_m),
  }), [f]);
  const ppf = parseNum(v.pecas_por_folha), alt = parseNum(v.altura_folha_m), larg = parseNum(v.largura_tecido_m);
  const kgp = ppf && alt !== null && larg !== null ? kgPorPeca({ pecas_por_folha: ppf, altura_folha_m: alt, largura_tecido_m: larg }, config) : null;
  const mudou = v.tamanho_referencia !== f.tamanho_referencia || v.pecas_por_folha !== mostra(f.pecas_por_folha)
    || v.altura_folha_m !== mostra(f.altura_folha_m) || v.largura_tecido_m !== mostra(f.largura_tecido_m);
  const onSalvar = async () => {
    if (!ppf || alt === null || larg === null || !v.tamanho_referencia.trim()) { setErro("Confira os números (até 3 casas) e o tamanho."); return; }
    setErro(null);
    try {
      await salvar.mutateAsync({ id: f.id, ativo: f.ativo, tamanho_referencia: v.tamanho_referencia.trim(), pecas_por_folha: ppf, altura_folha_m: alt, largura_tecido_m: larg });
    } catch (e: any) { setErro(e?.message ?? "Erro ao salvar"); }
  };
  const cel = (k: keyof typeof v, w = "w-20") => (
    <Input type="text" inputMode="decimal" className={`h-8 ${w}`} disabled={!podeEditar} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
  );
  return (
    <tr className="border-t align-top">
      <td className="px-2 py-1 font-medium">{f.modelo}</td>
      <td className="px-2 py-1">{cel("tamanho_referencia", "w-16")}</td>
      <td className="px-2 py-1">{cel("pecas_por_folha")}</td>
      <td className="px-2 py-1">{cel("altura_folha_m")}</td>
      <td className="px-2 py-1">{cel("largura_tecido_m")}</td>
      <td className="px-2 py-1 text-right tabular-nums font-semibold">{kgp === null ? "—" : kgp.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
      <td className="px-2 py-1">
        {podeEditar && <Button size="sm" onClick={onSalvar} disabled={!mudou || salvar.isPending}>Salvar</Button>}
        {erro && <p className="text-xs text-destructive mt-1">{erro}</p>}
      </td>
    </tr>
  );
}

export function ParametrosTab() {
  const isAdmin = useIsAdmin();
  const rows = usePlanConfigRows();
  const fichas = usePlanFichas();
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Parâmetros</h2>
      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <Lock className="h-4 w-4" /> Somente leitura: só admin pode alterar estes parâmetros e as fichas de encaixe.
        </div>
      )}
      <Card>
        <CardHeader><CardTitle>Parâmetros gerais</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {rows.error && <p className="text-sm text-destructive">{(rows.error as Error).message}</p>}
          {(rows.data ?? []).map((r) => <CampoConfig key={r.chave} {...r} podeEditar={isAdmin} />)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Ficha de encaixe</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          {fichas.error && <p className="text-sm text-destructive">{(fichas.error as Error).message}</p>}
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">Modelo</th><th className="px-2 py-1">Tam. ref.</th>
              <th className="px-2 py-1">Peças/folha</th><th className="px-2 py-1">Altura folha (m)</th>
              <th className="px-2 py-1">Largura (m)</th><th className="px-2 py-1 text-right">Kg por peça</th><th />
            </tr></thead>
            <tbody>{(fichas.data ?? []).map((f) => <LinhaFicha key={f.id} f={f} podeEditar={isAdmin} />)}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
