import type { Pedido } from "@/lib/pedidos";

export type SetorObs = "vendedor" | "producao" | "arte" | "dtf" | "silk" | "acabamento" | "expedicao";

const SETOR_LABEL: Record<SetorObs, string> = {
  vendedor: "Vendedor",
  producao: "Produção",
  arte: "Arte",
  dtf: "DTF",
  silk: "Silk",
  acabamento: "Acabamento",
  expedicao: "Expedição",
};

function getObs(p: Pedido, setor: SetorObs): string | null {
  const raw = (() => {
    switch (setor) {
      case "vendedor": return p.obs_vendedor;
      case "producao": return p.observacoes_pedido;
      case "arte": return p.arte_observacao;
      case "dtf": return p.dtf_observacao;
      case "silk": return p.silk_observacao;
      case "acabamento": return (p as any).acabamento_observacao ?? null;
      case "expedicao": return p.exp_observacoes;
    }
  })();
  const s = (raw ?? "").trim();
  return s.length ? s : null;
}

interface Props {
  pedido: Pedido;
  /** Setor cuja observação NÃO deve ser listada (a do textarea atual). */
  setorAtual: SetorObs;
  /** Quando informado, lista apenas estes setores (caso especial Dados In). */
  somente?: SetorObs[];
}

/** Lista compacta com Obs. de outros setores; só renderiza setores com conteúdo. */
export function ObservacoesOutrosSetores({ pedido, setorAtual, somente }: Props) {
  const setores = (somente ?? (["vendedor", "producao", "arte", "dtf", "silk", "acabamento", "expedicao"] as SetorObs[]))
    .filter((s) => s !== setorAtual);
  const items = setores
    .map((s) => ({ setor: s, txt: getObs(pedido, s) }))
    .filter((x): x is { setor: SetorObs; txt: string } => !!x.txt);

  if (items.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5 text-xs">
      {items.map(({ setor, txt }) => (
        <li key={setor} className="leading-snug">
          <span className="font-medium text-muted-foreground">Obs. {SETOR_LABEL[setor]}</span>
          <span className="text-muted-foreground"> - </span>
          <span className="whitespace-pre-wrap uppercase">{txt}</span>
        </li>
      ))}
    </ul>
  );
}
