// Derivação em memória do Consolidado de Perdas (aba Controle de Perdas).
// Nada é armazenado em duplicidade: PCP/COP são lidos ao vivo; apenas
// perdas_manuais e perdas_reclassificacoes têm tabela própria.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Cop, CopPerdaRegistro, Oficina, HistoricoPerda } from "@/lib/cop";
import { rotuloCop } from "@/lib/cop";
import type { Pedido, PecaPerdida, RefacaoEpisodio } from "@/lib/pedidos";

export type PerdaOrigem = "pcp" | "cop" | "manual";

export type PerdaFonte =
  | { kind: "pcp"; pedidoId: string; refacaoData: string; refacaoIdx: number; itemIdx: number }
  | { kind: "cop_historico"; copId: string; eventoEm: string; itemIdx: number }
  | { kind: "cop_perdas_fallback"; copId: string; itemIdx: number }
  | { kind: "cop_registro"; registroId: string }
  | { kind: "manual"; id: string }
  | { kind: "reclassificada"; reclassId: string; pedidoId: string; refacaoData: string; refacaoIdx: number };

export type PerdaConsolidada = {
  id: string;
  origem: PerdaOrigem;
  identificacao: string | null;
  data: string; // ISO
  modelo: string;
  cor: string;
  tamanho: string;
  qtd: number;
  motivo: string | null;
  area_erro?: string | null;
  erro_producao?: boolean | null;
  area_identificou?: string | null;
  problema?: string | null;
  oficina_id?: string | null;
  oficina_nome?: string | null;
  berco?: string | null;
  destino?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  reclassificada?: boolean;
  reclass?: {
    motivo_original: string | null;
    area_erro_original: string | null;
    observacao: string;
    usuario_id: string | null;
    created_at: string;
  };
  fonte: PerdaFonte;
};

export type PerdaManualRow = {
  id: string;
  data: string;
  modelo: string;
  cor: string;
  tamanho: string;
  qtd: number;
  motivo: string | null;
  oficina_id: string | null;
  berco: string | null;
  destino: string | null;
  responsavel: string | null;
  observacoes: string | null;
  registrado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type PerdaReclassRow = {
  id: string;
  pedido_id: string;
  refacao_data: string;
  refacao_idx: number;
  modelo: string;
  cor: string;
  tamanho: string;
  qtd: number;
  motivo_original: string | null;
  area_erro_original: string | null;
  motivo_novo: string;
  oficina_id: string | null;
  berco: string | null;
  destino: string | null;
  observacao: string;
  usuario_id: string | null;
  created_at: string;
};

function keyMCT(m: string, c: string, t: string) {
  return `${String(m).toUpperCase()}|${String(c).toUpperCase()}|${String(t).toUpperCase()}`;
}
function keyRefacao(pedidoId: string, refacaoData: string) {
  return `${pedidoId}|${refacaoData}`;
}

export function usePerdasConsolidadas() {
  const qCops = useQuery({
    queryKey: ["perdas-cons-cops"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cops")
        .select("id, numero, letra, refacao_perda_origem_id, refacao_perda_itens, perdas, historico_perdas, updated_at, oficina_id");
      if (error) throw error;
      return (data ?? []) as Array<Pick<Cop, "id" | "numero" | "letra" | "refacao_perda_origem_id" | "refacao_perda_itens" | "perdas" | "historico_perdas" | "updated_at" | "oficina_id">>;
    },
  });


  const qCopPerdas = useQuery({
    queryKey: ["perdas-cons-copperdas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cop_perdas" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as CopPerdaRegistro[];
    },
  });

  const qOficinas = useQuery({
    queryKey: ["perdas-cons-oficinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas" as any).select("id, nome");
      if (error) throw error;
      return (data ?? []) as unknown as Pick<Oficina, "id" | "nome">[];
    },
  });

  const qPedidos = useQuery({
    queryKey: ["perdas-cons-pedidos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pedidos")
        .select("id, orcamento, pedido_olist, refacoes, updated_at");
      if (error) throw error;
      return (data ?? []) as Array<Pick<Pedido, "id" | "orcamento" | "pedido_olist" | "refacoes" | "updated_at">>;
    },
  });

  const qManuais = useQuery({
    queryKey: ["perdas-cons-manuais"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("perdas_manuais").select("*").order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PerdaManualRow[];
    },
  });

  const qReclass = useQuery({
    queryKey: ["perdas-cons-reclass"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("perdas_reclassificacoes").select("*");
      if (error) throw error;
      return (data ?? []) as PerdaReclassRow[];
    },
  });

  const isLoading =
    qCops.isLoading || qCopPerdas.isLoading || qOficinas.isLoading ||
    qPedidos.isLoading || qManuais.isLoading || qReclass.isLoading;

  const perdas = useMemo<PerdaConsolidada[]>(() => {
    const cops = qCops.data ?? [];
    const copPerdas = qCopPerdas.data ?? [];
    const oficinas = qOficinas.data ?? [];
    const pedidos = qPedidos.data ?? [];
    const manuais = qManuais.data ?? [];
    const reclass = qReclass.data ?? [];

    const oficinaNome = (id: string | null | undefined) =>
      id ? oficinas.find((o) => o.id === id)?.nome ?? null : null;

    // Índice de reclassificações por episódio (pedido_id + refacao_data)
    // e por chave completa (+ modelo|cor|tamanho) para subtração de qtd.
    const reclassPorMCT = new Map<string, PerdaReclassRow[]>();
    for (const r of reclass) {
      const k = `${keyRefacao(r.pedido_id, r.refacao_data)}|${keyMCT(r.modelo, r.cor, r.tamanho)}`;
      const arr = reclassPorMCT.get(k) ?? [];
      arr.push(r);
      reclassPorMCT.set(k, arr);
    }

    const out: PerdaConsolidada[] = [];

    // Refeitas por COP: soma perda_qtd de todos refacao_perda_itens em COPs filhos.
    // Chave: origem_cop_id (fallback: refacao_perda_origem_id do filho) + modelo|cor|tamanho.
    const refeitasPorCopMCT = new Map<string, number>();
    for (const filho of cops) {
      const parentDefault = (filho as any).refacao_perda_origem_id as string | null;
      if (!parentDefault) continue;
      const itens = Array.isArray((filho as any).refacao_perda_itens) ? ((filho as any).refacao_perda_itens as any[]) : [];
      for (const it of itens) {
        const origemId = (it.origem_cop_id as string | null | undefined) ?? parentDefault;
        if (!origemId) continue;
        const pm = it.perda_modelo ?? it.modelo;
        const pc = it.perda_cor ?? it.cor;
        const pt = it.perda_tamanho ?? it.tamanho;
        const pq = Number(it.perda_qtd ?? it.qtd) || 0;
        if (pq <= 0) continue;
        const k = `${origemId}|${keyMCT(pm, pc, pt)}`;
        refeitasPorCopMCT.set(k, (refeitasPorCopMCT.get(k) ?? 0) + pq);
      }
    }
    const consumirRefeita = (copId: string | null | undefined, modelo: string, cor: string, tamanho: string, qtd: number): number => {
      if (!copId) return qtd;
      const k = `${copId}|${keyMCT(modelo, cor, tamanho)}`;
      const disp = refeitasPorCopMCT.get(k) ?? 0;
      if (disp <= 0) return qtd;
      const usar = Math.min(disp, qtd);
      refeitasPorCopMCT.set(k, disp - usar);
      return qtd - usar;
    };

    // Fonte A: cops.historico_perdas  (fallback: cops.perdas se histórico vazio)
    for (const c of cops) {
      const rotulo = rotuloCop(c.numero, c.letra, !!c.refacao_perda_origem_id);
      const hist = Array.isArray(c.historico_perdas) ? (c.historico_perdas as HistoricoPerda[]) : [];
      const lancs = lancamentosPerda({ historico_perdas: hist }).filter((l) => !l.estornado && l.qtd > 0);
      if (hist.some((h) => h?.tipo === "perda")) {
        for (const l of lancs) {
          const qtd = consumirRefeita(c.id, l.modelo, l.cor, l.tamanho, l.qtd);
          if (qtd <= 0) continue;
          out.push({
            id: `cop-hist:${c.id}:${l.em}:${l.item_idx}`,
            origem: "cop",
            identificacao: rotulo,
            data: l.em,
            modelo: l.modelo,
            cor: l.cor,
            tamanho: l.tamanho,
            qtd,
            motivo: l.motivo ?? null,
            oficina_id: c.oficina_id ?? null,
            oficina_nome: oficinaNome(c.oficina_id),
            fonte: { kind: "cop_historico", copId: c.id, eventoEm: l.em, itemIdx: l.item_idx },
          });
        }
      }


    // Fonte B: cop_perdas
    const copsById = new Map(cops.map((c) => [c.id, c] as const));
    for (const r of copPerdas) {
      const qtdOrig = Number(r.qtd) || 0;
      if (qtdOrig <= 0) continue;
      const cop = r.cop_id ? copsById.get(r.cop_id) : null;
      const qtd = consumirRefeita(r.cop_id ?? null, r.modelo, r.cor, r.tamanho, qtdOrig);
      if (qtd <= 0) continue;
      const identificacao = cop
        ? rotuloCop(cop.numero, cop.letra, !!cop.refacao_perda_origem_id)
        : (r.etiqueta ?? null);
      out.push({
        id: `cop-reg:${r.id}`,
        origem: "cop",
        identificacao,
        data: r.created_at,
        modelo: r.modelo,
        cor: r.cor,
        tamanho: r.tamanho,
        qtd,
        motivo: r.motivo ?? null,
        oficina_id: r.oficina_id ?? null,
        oficina_nome: oficinaNome(r.oficina_id),
        responsavel: r.registrado_por ?? null,
        fonte: { kind: "cop_registro", registroId: r.id },
      });
    }



    // Fonte C: pedidos.refacoes[].pecas_perdidas (com dedução por reclassificação)
    for (const p of pedidos) {
      const refs = Array.isArray(p.refacoes) ? (p.refacoes as RefacaoEpisodio[]) : [];
      refs.forEach((ep, refIdx) => {
        const pecas: PecaPerdida[] = Array.isArray(ep.pecas_perdidas) ? ep.pecas_perdidas : [];
        pecas.forEach((pp, itemIdx) => {
          const qtdOrig = Number(pp.qtd) || 0;
          if (qtdOrig <= 0) return;
          const k = `${keyRefacao(p.id, ep.data)}|${keyMCT(pp.modelo, pp.cor, pp.tamanho)}`;
          const matches = reclassPorMCT.get(k) ?? [];
          const jaReclass = matches
            .filter((r) => r.refacao_idx === refIdx || Number.isNaN(r.refacao_idx))
            .reduce((s, r) => s + (Number(r.qtd) || 0), 0);
          const qtdRestante = Math.max(0, qtdOrig - jaReclass);
          if (qtdRestante <= 0) return; // suprimida (total)
          out.push({
            id: `pcp:${p.id}:${refIdx}:${itemIdx}`,
            origem: "pcp",
            identificacao: p.pedido_olist ?? p.orcamento ?? null,
            data: ep.data,
            modelo: pp.modelo,
            cor: pp.cor,
            tamanho: pp.tamanho,
            qtd: qtdRestante,
            motivo: ep.motivo ?? null,
            area_erro: ep.area_erro ?? null,
            erro_producao: ep.erro_producao ?? null,
            area_identificou: ep.area_identificou ?? null,
            problema: ep.problema ?? null,
            fonte: { kind: "pcp", pedidoId: p.id, refacaoData: ep.data, refacaoIdx: refIdx, itemIdx },
          });
        });
      });
    }

    // Fonte reclass: linhas manuais derivadas de reclassificações
    const pedidosById = new Map(pedidos.map((p) => [p.id, p] as const));
    for (const r of reclass) {
      const ped = pedidosById.get(r.pedido_id);
      const refs = Array.isArray(ped?.refacoes) ? (ped!.refacoes as RefacaoEpisodio[]) : [];
      const ep = refs[r.refacao_idx] ?? refs.find((e) => e.data === r.refacao_data);
      out.push({
        id: `reclass:${r.id}`,
        origem: "manual",
        identificacao: ped ? (ped.pedido_olist ?? ped.orcamento ?? null) : null,
        data: r.created_at,
        modelo: r.modelo,
        cor: r.cor,
        tamanho: r.tamanho,
        qtd: Number(r.qtd) || 0,
        motivo: r.motivo_novo,
        oficina_id: r.oficina_id ?? null,
        oficina_nome: oficinaNome(r.oficina_id),
        berco: r.berco ?? null,
        destino: r.destino ?? null,
        reclassificada: true,
        reclass: {
          motivo_original: r.motivo_original ?? (ep?.motivo ?? null),
          area_erro_original: r.area_erro_original ?? (ep?.area_erro ?? null),
          observacao: r.observacao,
          usuario_id: r.usuario_id ?? null,
          created_at: r.created_at,
        },
        fonte: { kind: "reclassificada", reclassId: r.id, pedidoId: r.pedido_id, refacaoData: r.refacao_data, refacaoIdx: r.refacao_idx },
      });
    }

    // Fonte D: perdas_manuais
    for (const m of manuais) {
      out.push({
        id: `manual:${m.id}`,
        origem: "manual",
        identificacao: null,
        data: m.data,
        modelo: m.modelo,
        cor: m.cor,
        tamanho: m.tamanho,
        qtd: Number(m.qtd) || 0,
        motivo: m.motivo ?? null,
        oficina_id: m.oficina_id ?? null,
        oficina_nome: oficinaNome(m.oficina_id),
        berco: m.berco ?? null,
        destino: m.destino ?? null,
        responsavel: m.responsavel ?? null,
        observacoes: m.observacoes ?? null,
        fonte: { kind: "manual", id: m.id },
      });
    }

    // Ordenação padrão: data desc
    out.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
    return out;
  }, [qCops.data, qCopPerdas.data, qOficinas.data, qPedidos.data, qManuais.data, qReclass.data]);

  return { perdas, isLoading, oficinas: qOficinas.data ?? [] };
}

/** Índice de reclassificações por pedido/refacao — para o selo no viewer do PCP. */
export function useReclassificacoesDoPedido(pedidoId: string | null | undefined) {
  return useQuery({
    queryKey: ["perdas-reclass-pedido", pedidoId],
    enabled: !!pedidoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("perdas_reclassificacoes")
        .select("*")
        .eq("pedido_id", pedidoId!);
      if (error) throw error;
      return (data ?? []) as PerdaReclassRow[];
    },
  });
}
