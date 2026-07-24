import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, RotateCcw, Undo2, Layers, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { REFACAO_MODELOS, REFACAO_CORES, REFACAO_TAMANHOS } from "@/lib/pedidos";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import type { Cop, CopPeca, CopPerdaRegistro, CopPerdaLinha, CopRefacaoPerdaItem, Oficina } from "@/lib/cop";
import { formatCopNumero, somarPerdas, subtrairPerdas, somarPecas, STATUS_CORTE, rotuloCop, rotuloCopObj } from "@/lib/cop";

import { useIsAdmin, useCanAccessCop } from "@/hooks/use-role";
import { RefazerPerdaDialog, type RefazerCopInput } from "./RefazerPerdaDialog";

export function PerdasTab() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const canAccessCop = useCanAccessCop();

  const { data: oficinas = [] } = useQuery({
    queryKey: ["oficinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas" as any).select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Oficina[];
    },
  });

  const { data: perdas = [] } = useQuery({
    queryKey: ["cop_perdas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cop_perdas" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CopPerdaRegistro[];
    },
  });

  const { data: cops = [] } = useQuery({
    queryKey: ["cops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cops" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Cop[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("cop-perdas")
      .on("postgres_changes", { event: "*", schema: "public", table: "cop_perdas" }, () => qc.invalidateQueries({ queryKey: ["cop_perdas"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "cops" }, () => qc.invalidateQueries({ queryKey: ["cops"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  /** Agrupa perdas por COP e calcula perdas restantes (após refações filhas). */
  const perdasPorCop = useMemo(() => {
    type Entry = { cop: Cop; original: CopPerdaLinha[]; restantes: CopPerdaLinha[] };
    const out: Entry[] = [];
    for (const c of cops) {
      // `cop.perdas` já é o saldo restante: ao criar uma refação, os itens
      // enviados são subtraídos via `subtrairPerdas` no update do COP de origem.
      // Portanto NÃO subtraia novamente os `refacao_perda_itens` dos filhos,
      // senão o restante fica duplamente descontado (vira 0 indevidamente).
      const restantes = ((c.perdas as CopPerdaLinha[]) ?? []).filter((l) => l && l.qtd > 0);
      if (!restantes.length) continue;
      out.push({ cop: c, original: restantes, restantes });
    }
    return out;
  }, [cops]);

  /** Lista de refações (filhos). */
  const refacoes = useMemo(() => {
    return cops
      .filter((c) => !!(c as any).refacao_perda_origem_id)
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  }, [cops]);

  const copById = useMemo(() => {
    const m = new Map<string, Cop>();
    for (const c of cops) m.set(c.id, c);
    return m;
  }, [cops]);

  // ============ Consolidação / dialog ============
  const [consolidarMode, setConsolidarMode] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [dialogInputs, setDialogInputs] = useState<RefazerCopInput[] | null>(null);

  function toggleSel(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function abrirRefazerSingle(entry: { cop: Cop; restantes: CopPerdaLinha[] }) {
    setDialogInputs([{ cop: entry.cop, perdasRestantes: entry.restantes }]);
  }
  function abrirRefazerConsolidado() {
    const list = perdasPorCop.filter((e) => selecionados.has(e.cop.id) && e.restantes.length > 0);
    if (!list.length) { toast.error("Selecione ao menos um romaneio com perdas restantes."); return; }
    setDialogInputs(list.map((e) => ({ cop: e.cop, perdasRestantes: e.restantes })));
  }

  const refazerMut = useMutation({
    mutationFn: async (selecoes: Array<{ cop: Cop; itens: CopRefacaoPerdaItem[] }>) => {
      // Consolida itens de todos os COPs de origem em um único conjunto de peças
      let pecasConsolidadas: CopPeca[] = [];
      const origensRotulos: string[] = [];
      for (const s of selecoes) {
        pecasConsolidadas = somarPecas(
          pecasConsolidadas,
          s.itens.map((it) => ({ modelo: it.modelo, cor: it.cor, tamanho: it.tamanho, qtd: it.qtd })),
        );
        origensRotulos.push(`${formatCopNumero(s.cop.numero)}${s.cop.letra ?? ""}`);
      }
      // Registra todos os itens (para desfazer) marcando o cop_id de origem
      const itensRefacaoParaJson = selecoes.flatMap((s) =>
        s.itens.map((it) => ({ ...it, origem_cop_id: s.cop.id })),
      );
      // Vincula a "refacao_perda_origem_id" ao primeiro (compatibilidade com single);
      // consolidados podem ter várias origens, mas o campo aponta o primeiro; itens
      // preservam origem_cop_id para desfazer corretamente.
      const origemPrincipal = selecoes[0].cop.id;
      const obs = origensRotulos.length === 1
        ? `REFAÇÃO DE PERDA — COP ${origensRotulos[0]}`
        : `REFAÇÃO DE PERDA (CONSOLIDADA) — COPS ${origensRotulos.join(", ")}`;

      // 1) cria novo COP
      const { data: novo, error: eIns } = await supabase.from("cops" as any).insert({
        status: "Aguardando Risco",
        pecas: pecasConsolidadas,
        observacoes_corte: obs,
        refacao_perda_origem_id: origemPrincipal,
        refacao_perda_itens: itensRefacaoParaJson,
      }).select().single();
      if (eIns) throw eIns;

      // 2) subtrai perdas em cada COP de origem
      for (const s of selecoes) {
        const atual = ((s.cop.perdas as CopPerdaLinha[]) ?? []);
        // Recomputa restantes com base no state real do cop no db (usa o atual já lido)
        const filhosOutros = cops
          .filter((f) => (f as any).refacao_perda_origem_id === s.cop.id)
          .flatMap((f) => (((f as any).refacao_perda_itens as any[]) ?? [])
            .filter((it) => (it.origem_cop_id ?? s.cop.id) === s.cop.id));
        // Não precisamos recomputar aqui; apenas subtraímos os itens desta operação
        const novasPerdas = subtrairPerdas(atual, s.itens);
        const { error: eUpd } = await supabase.from("cops" as any)
          .update({ perdas: novasPerdas })
          .eq("id", s.cop.id);
        if (eUpd) {
          // rollback: apaga o COP novo
          await supabase.from("cops" as any).delete().eq("id", (novo as any).id);
          throw eUpd;
        }
        void filhosOutros;
      }
      return novo as any;
    },
    onSuccess: (novo: any) => {
      toast.success(`COP ${formatCopNumero(novo.numero)} criado para refação.`);
      setConsolidarMode(false);
      setSelecionados(new Set());
      setDialogInputs(null);
      qc.invalidateQueries({ queryKey: ["cops"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao refazer perda."),
  });

  const desfazerMut = useMutation({
    mutationFn: async (filho: Cop) => {
      const itens = (((filho as any).refacao_perda_itens as any[]) ?? []) as (CopPerdaLinha & { origem_cop_id?: string })[];
      if (!itens.length) throw new Error("Sem itens de refação registrados.");
      // Agrupa por cop de origem
      const porOrigem = new Map<string, CopPerdaLinha[]>();
      for (const it of itens) {
        const oid = it.origem_cop_id ?? (filho as any).refacao_perda_origem_id;
        if (!oid) continue;
        const arr = porOrigem.get(oid) ?? [];
        arr.push({ modelo: it.modelo, cor: it.cor, tamanho: it.tamanho, qtd: it.qtd, motivo: it.motivo ?? null });
        porOrigem.set(oid, arr);
      }
      // Restaura perdas em cada origem
      for (const [oid, its] of porOrigem.entries()) {
        const origem = copById.get(oid);
        if (!origem) continue;
        const atual = ((origem.perdas as CopPerdaLinha[]) ?? []);
        const restauradas = somarPerdas(atual, its);
        const { error } = await supabase.from("cops" as any)
          .update({ perdas: restauradas }).eq("id", oid);
        if (error) throw error;
      }
      // Deleta o filho
      const { error: eDel } = await supabase.from("cops" as any).delete().eq("id", filho.id);
      if (eDel) throw eDel;
    },
    onSuccess: () => {
      toast.success("Refação desfeita.");
      qc.invalidateQueries({ queryKey: ["cops"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao desfazer refação."),
  });

  // ============ Form de perdas manuais (existente) ============
  const [form, setForm] = useState({
    oficina_id: "", etiqueta: "", modelo: "", cor: "", tamanho: "", qtd: 1, motivo: "",
  });
  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.modelo || !form.cor || !form.tamanho || form.qtd <= 0) {
        throw new Error("Preencha modelo, cor, tamanho e quantidade.");
      }
      const { data: ses } = await supabase.auth.getUser();
      const { error } = await supabase.from("cop_perdas" as any).insert({
        oficina_id: form.oficina_id || null,
        etiqueta: form.etiqueta || null,
        modelo: form.modelo, cor: form.cor, tamanho: form.tamanho, qtd: form.qtd,
        motivo: form.motivo || null,
        registrado_por: ses.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perda registrada.");
      setForm({ oficina_id: "", etiqueta: "", modelo: "", cor: "", tamanho: "", qtd: 1, motivo: "" });
      qc.invalidateQueries({ queryKey: ["cop_perdas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro."),
  });
  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cop_perdas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["cop_perdas"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro."),
  });

  const ofiNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of oficinas) m.set(o.id, o.nome);
    return m;
  }, [oficinas]);

  function podeDesfazer(filho: Cop): boolean {
    // Só se ainda está no fluxo de Corte (não enviado ao romaneio) e sem recebimentos
    if (!STATUS_CORTE.includes(filho.status)) return false;
    if (filho.romaneio_enviado_em) return false;
    const rec = (filho.pecas_recebidas ?? []) as any[];
    if (rec.some((r) => (r?.qtd_recebida ?? 0) > 0)) return false;
    return true;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Perdas</h2>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Registrar perda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            <div className="md:col-span-2">
              <Label>Oficina</Label>
              <Select value={form.oficina_id} onValueChange={(v) => setForm((f) => ({ ...f, oficina_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {oficinas.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Etiqueta</Label>
              <Input value={form.etiqueta} onChange={(e) => setForm((f) => ({ ...f, etiqueta: e.target.value }))} />
            </div>
            <div>
              <Label>Modelo</Label>
              <Select value={form.modelo} onValueChange={(v) => setForm((f) => ({ ...f, modelo: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{REFACAO_MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <Select value={form.cor} onValueChange={(v) => setForm((f) => ({ ...f, cor: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {REFACAO_CORES.map((c) => {
                    const fg = corTextoSobre(c.hex);
                    return <SelectItem key={c.nome} value={c.nome} style={{ backgroundColor: c.hex, color: fg }}>{c.nome}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tamanho</Label>
              <Select value={form.tamanho} onValueChange={(v) => setForm((f) => ({ ...f, tamanho: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{REFACAO_TAMANHOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Qtd</Label>
              <Input type="number" min={1} value={form.qtd} onChange={(e) => setForm((f) => ({ ...f, qtd: Math.max(1, Math.floor(Number(e.target.value) || 1)) }))} />
            </div>
            <div className="md:col-span-7">
              <Label>Motivo</Label>
              <Textarea rows={2} className="uppercase" value={form.motivo} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} />
            </div>
            <div className="md:col-span-7 flex justify-end">
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}><Plus className="h-4 w-4 mr-1" /> Registrar perda</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">As perdas registradas aqui e nos romaneios reduzem o saldo Disponível.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Perdas registradas em romaneios</CardTitle>
            {canAccessCop && (
              <div className="flex items-center gap-2">
                {consolidarMode ? (
                  <>
                    <span className="text-xs text-muted-foreground">{selecionados.size} selecionado(s)</span>
                    <Button size="sm" variant="outline" onClick={() => { setConsolidarMode(false); setSelecionados(new Set()); }}>Cancelar</Button>
                    <Button size="sm" onClick={abrirRefazerConsolidado} disabled={selecionados.size === 0}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Refazer selecionados
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setConsolidarMode(true)}>
                    <Layers className="h-4 w-4 mr-1" /> Consolidar perdas
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto max-h-[70vh] tbl-congelada">
            <table className="w-full text-[12.5px] leading-[1.2]">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  {consolidarMode && <th className="p-2 w-8"></th>}
                  <th className="p-2 text-left">COP</th>
                  <th className="p-2 text-left">Oficina</th>
                  <th className="p-2 text-left">Modelo</th>
                  <th className="p-2 text-left">Cor</th>
                  <th className="p-2 text-center">Tam.</th>
                  <th className="p-2 text-right">Qtd (rest.)</th>
                  <th className="p-2 text-left">Motivo</th>
                  {canAccessCop && !consolidarMode && <th className="p-2"></th>}
                </tr>
              </thead>
              <tbody>
                {perdasPorCop.length === 0 ? (
                  <tr><td colSpan={consolidarMode ? 8 : (canAccessCop ? 8 : 7)} className="p-3 text-center text-muted-foreground">Sem perdas em romaneios.</td></tr>
                ) : perdasPorCop.map((entry, gIdx) => {
                  const { cop, restantes } = entry;
                  const totalRest = restantes.reduce((s, l) => s + l.qtd, 0);
                  const rows = restantes.length > 0 ? restantes : entry.original.map((l) => ({ ...l, qtd: 0 }));
                  return rows.map((linha, i) => {
                    const hex = corHex(linha.cor); const fg = corTextoSobre(hex);
                    const first = i === 0;
                    return (
                      <tr key={`${cop.id}-${i}`} className={`border-t ${gIdx % 2 === 1 ? "bg-muted/60" : ""}`}>
                        {consolidarMode && (
                          <td className="p-2 align-top">
                            {first && (
                              <Checkbox
                                checked={selecionados.has(cop.id)}
                                onCheckedChange={() => toggleSel(cop.id)}
                                disabled={totalRest === 0}
                              />
                            )}
                          </td>
                        )}
                        <td className="p-2 font-semibold tabular-nums align-top">{first ? `${formatCopNumero(cop.numero)}${cop.letra ?? ""}` : ""}</td>
                        <td className="p-2 align-top">{first ? (cop.oficina_id ? (ofiNome.get(cop.oficina_id) ?? "—") : "—") : ""}</td>
                        <td className="p-2">{linha.modelo}</td>
                        <td className="p-2"><span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: hex, color: fg }}>{linha.cor}</span></td>
                        <td className="p-2 text-center">{linha.tamanho}</td>
                        <td className="p-2 text-right tabular-nums">{linha.qtd}</td>
                        <td className="p-2 text-xs">{linha.motivo ?? "—"}</td>
                        {canAccessCop && !consolidarMode && (
                          <td className="p-2 text-right align-top">
                            {first && totalRest > 0 && (
                              <Button size="sm" variant="outline" onClick={() => abrirRefazerSingle(entry)}>
                                <RotateCcw className="h-3 w-3 mr-1" /> Refazer perda
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {refacoes.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Refações de perda</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-[12.5px] leading-[1.2]">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="p-2 text-left w-[130px]">Data</th>
                    <th className="p-2 text-left">Perda original</th>
                    <th className="p-2 w-10"></th>
                    <th className="p-2 text-left">Refação</th>
                    <th className="p-2 text-left w-[130px]">Status</th>
                    {canAccessCop && <th className="p-2 w-[100px]"></th>}
                  </tr>
                </thead>
                <tbody>
                  {refacoes.map((f, gIdx) => {
                    const its = (((f as any).refacao_perda_itens as CopRefacaoPerdaItem[]) ?? []);
                    // "Perda original" agrupa pelos campos perda_* (fallback aos itens legados)
                    const perdaLinhas = its.map((it) => ({
                      modelo: it.perda_modelo ?? it.modelo,
                      cor: it.perda_cor ?? it.cor,
                      tamanho: it.perda_tamanho ?? it.tamanho,
                      qtd: it.perda_qtd ?? it.qtd,
                      origem_cop_id: it.origem_cop_id ?? (f as any).refacao_perda_origem_id,
                    }));
                    // "Refeito" = peças REAIS do COP filho (fonte da verdade, refletindo edições posteriores)
                    const refeitoLinhas = (f.pecas ?? []).filter((p) => p && p.qtd > 0);
                    const novoRotulo = rotuloCopObj(f);
                    // Origens (podem ser múltiplos em consolidados)
                    const origensIds = Array.from(new Set(perdaLinhas.map((l) => l.origem_cop_id).filter(Boolean))) as string[];
                    const origensRotulos = origensIds.map((oid) => {
                      const c = copById.get(oid);
                      return c ? `${formatCopNumero(c.numero)}${c.letra ?? ""}` : "—";
                    });
                    return (
                      <tr key={f.id} className={`border-t align-top ${gIdx % 2 === 1 ? "bg-muted/60" : ""}`}>
                        <td className="p-2 text-xs align-top">
                          {new Date(f.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-2 align-top">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Perda original</span>
                              <span className="text-xs font-semibold tabular-nums">
                                COP {origensRotulos.join(", ") || "—"}
                              </span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              {perdaLinhas.length === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : perdaLinhas.map((l, i) => {
                                const hex = corHex(l.cor); const fg = corTextoSobre(hex);
                                return (
                                  <div key={i} className="flex items-center gap-1.5 flex-wrap text-xs">
                                    <span className="font-medium">{l.modelo}</span>
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: hex, color: fg }}>{l.cor}</span>
                                    <span className="text-muted-foreground">{l.tamanho}</span>
                                    <span className="tabular-nums font-semibold">{l.qtd} pç</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="p-2 align-middle text-center">
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </div>
                        </td>
                        <td className="p-2 align-top">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Refeito</span>
                              <span className="text-xs font-semibold tabular-nums">COP {novoRotulo}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              {refeitoLinhas.length === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : refeitoLinhas.map((p, i) => {
                                const hex = corHex(p.cor); const fg = corTextoSobre(hex);
                                return (
                                  <div key={i} className="flex items-center gap-1.5 flex-wrap text-xs">
                                    <span className="font-medium">{p.modelo}</span>
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: hex, color: fg }}>{p.cor}</span>
                                    <span className="text-muted-foreground">{p.tamanho}</span>
                                    <span className="tabular-nums font-semibold">{p.qtd} pç</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="p-2 text-xs align-top">{f.status}</td>
                        {canAccessCop && (
                          <td className="p-2 text-right align-top">
                            {podeDesfazer(f) ? (
                              <Button size="sm" variant="ghost" onClick={() => {
                                if (confirm(`Desfazer refação do COP ${rotuloCopObj(f)}?\nO COP será excluído e as perdas restauradas.`)) {
                                  desfazerMut.mutate(f);
                                }
                              }}>
                                <Undo2 className="h-3 w-3 mr-1" /> Desfazer
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          </CardContent>
        </Card>
      )}



      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Histórico de perdas</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-[12.5px] leading-[1.2]">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">Oficina</th>
                  <th className="p-2 text-left">Etiqueta</th>
                  <th className="p-2 text-left">Modelo</th>
                  <th className="p-2 text-left">Cor</th>
                  <th className="p-2 text-center">Tam.</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2 text-left">Motivo</th>
                  {isAdmin && <th className="p-2"></th>}
                </tr>
              </thead>
              <tbody>
                {perdas.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 9 : 8} className="p-3 text-center text-muted-foreground">Sem registros.</td></tr>
                ) : perdas.map((p, i) => {
                  const hex = corHex(p.cor); const fg = corTextoSobre(hex);
                  return (
                    <tr key={p.id} className={`border-t ${i % 2 === 1 ? "bg-muted/80" : ""}`}>
                      <td className="p-2 text-xs">{new Date(p.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2">{p.oficina_id ? (ofiNome.get(p.oficina_id) ?? "—") : "—"}</td>
                      <td className="p-2 font-mono text-xs">{p.etiqueta ?? "—"}</td>
                      <td className="p-2">{p.modelo}</td>
                      <td className="p-2"><span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: hex, color: fg }}>{p.cor}</span></td>
                      <td className="p-2 text-center">{p.tamanho}</td>
                      <td className="p-2 text-right tabular-nums">{p.qtd}</td>
                      <td className="p-2 text-xs">{p.motivo ?? "—"}</td>
                      {isAdmin && (
                        <td className="p-2 text-right">
                          <Button size="icon" variant="ghost" onClick={() => remover.mutate(p.id)} title="Remover">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <RefazerPerdaDialog
        open={!!dialogInputs}
        onOpenChange={(v) => { if (!v) setDialogInputs(null); }}
        cops={dialogInputs ?? []}
        onConfirm={async (selecoes) => { await refazerMut.mutateAsync(selecoes); }}
      />
    </div>
  );
}
