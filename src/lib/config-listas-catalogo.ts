import type { AppListKind } from "@/lib/app-lists";

export type ListaModulo = "pcp" | "cop" | "map" | "sup";
export type ModuloVisual = ListaModulo | "sistema";

export interface ListaCatalogoItem {
  kind: AppListKind;
  titulo: string;
  placeholder: string;
  /** Onde a lista é ESCOLHIDA (aparece como dropdown para o usuário). */
  modulos: ListaModulo[];
  /** Subdivisão dentro do módulo. */
  grupo: string;
  /** Texto informativo de rodapé: onde o valor é consumido. */
  notaUso?: string;
}

export const LISTAS_CATALOGO: ListaCatalogoItem[] = [
  // ---------- PCP · Dados In ----------
  { kind: "vendedor", titulo: "Vendedores", placeholder: "Novo vendedor", modulos: ["pcp"], grupo: "Dados In" },
  { kind: "frete", titulo: "Frete (transportadoras)", placeholder: "Nova opção de frete", modulos: ["pcp"], grupo: "Dados In" },
  { kind: "pagamento", titulo: "Tipo de Pagamento", placeholder: "Nova forma de pagamento", modulos: ["pcp"], grupo: "Dados In" },
  { kind: "nf", titulo: "Nota Fiscal", placeholder: "Nova opção (ex.: Sim, Não, Não se aplica)", modulos: ["pcp"], grupo: "Dados In" },

  // ---------- PCP · Arte ----------
  { kind: "status_arte", titulo: "Status da Arte", placeholder: "Nova opção de Status da Arte", modulos: ["pcp"], grupo: "Arte" },

  // ---------- PCP · Produção ----------
  { kind: "dtf", titulo: "Operadores DTF", placeholder: "Novo operador DTF", modulos: ["pcp"], grupo: "Produção" },
  { kind: "silk", titulo: "Operadores Silk", placeholder: "Novo operador Silk", modulos: ["pcp"], grupo: "Produção" },
  { kind: "acabamento", titulo: "Responsáveis pelo Acabamento", placeholder: "Novo responsável", modulos: ["pcp"], grupo: "Produção" },
  { kind: "corte_dtf", titulo: "Quem cortou o DTF", placeholder: "Novo responsável pelo corte", modulos: ["pcp"], grupo: "Produção" },
  { kind: "revelacao_silk", titulo: "Quem revelou a tela (Silk)", placeholder: "Nova pessoa", modulos: ["pcp"], grupo: "Produção" },

  // ---------- PCP · Refação ----------
  { kind: "refacao_area_identifica", titulo: "Área que identificou o problema", placeholder: "Nova área", modulos: ["pcp"], grupo: "Refação" },
  {
    kind: "refacao_area_erro",
    titulo: "Área que errou a produção",
    placeholder: "Nova área",
    modulos: ["pcp"],
    grupo: "Refação",
    notaUso: "Escolhida na Refação do PCP. O valor gravado também é exibido no COP, na correção de perdas.",
  },
  { kind: "refacao_problema_arte", titulo: "Problemas da Arte", placeholder: "Novo problema", modulos: ["pcp"], grupo: "Refação" },
  { kind: "refacao_problema_dtf", titulo: "Problemas do DTF", placeholder: "Novo problema", modulos: ["pcp"], grupo: "Refação" },
  { kind: "refacao_problema_silk", titulo: "Problemas do Silk", placeholder: "Novo problema", modulos: ["pcp"], grupo: "Refação" },
  { kind: "refacao_problema_acabamento", titulo: "Problemas do Acabamento", placeholder: "Novo problema", modulos: ["pcp"], grupo: "Refação" },

  // ---------- PCP + COP · Perdas (compartilhada) ----------
  {
    kind: "motivo_perda",
    titulo: "Motivos de perda",
    placeholder: "Ex.: Mancha no tecido",
    modulos: ["pcp", "cop"],
    grupo: "Perdas",
    notaUso: "Escolhida nos registros de perda do COP e, na Refação do PCP, quando a área de erro não é Arte/DTF/Silk/Acabamento.",
  },

  // ---------- COP · Perdas ----------
  {
    kind: "destino_perda",
    titulo: "Destinos de peças perdidas",
    placeholder: "Ex.: Reciclagem",
    modulos: ["cop"],
    grupo: "Perdas",
    notaUso: "Escolhida no registro manual e na correção de perdas do COP.",
  },

  // ---------- MAP · Cadeia de fornecimento ----------
  { kind: "map_fio_fornecedor", titulo: "Fornecedores de fio", placeholder: "Ex.: Ventuno", modulos: ["map"], grupo: "Cadeia de fornecimento" },
  { kind: "map_malharia", titulo: "Malharias", placeholder: "Ex.: Mavelo", modulos: ["map"], grupo: "Cadeia de fornecimento" },
  { kind: "map_tinturaria", titulo: "Tinturarias", placeholder: "Ex.: Martêxtil", modulos: ["map"], grupo: "Cadeia de fornecimento" },
  { kind: "map_acabamento", titulo: "Acabamentos", placeholder: "Ex.: ACAB5", modulos: ["map"], grupo: "Cadeia de fornecimento" },

  // ---------- MAP · Devoluções ----------
  { kind: "map_motivo_devolucao", titulo: "Motivos de devolução", placeholder: "Ex.: cor errada", modulos: ["map"], grupo: "Devoluções" },

  // ---------- SUP · Produtos ----------
  {
    kind: "sup_unidade",
    titulo: "Unidades de medida",
    placeholder: "Ex.: rolo",
    modulos: ["sup"],
    grupo: "Produtos",
    notaUso: "Escolhida no cadastro de produtos do SUP e na unidade de referência dos grupos de itens equivalentes.",
  },
];

/** Rótulo curto do módulo. */
export function moduloLabel(modulo: ModuloVisual): string {
  switch (modulo) {
    case "pcp": return "PCP";
    case "cop": return "COP";
    case "map": return "MAP";
    case "sup": return "SUP";
    default: return "Sistema";
  }
}

/** Classes do badge de módulo — reaproveita as cores já usadas no app. */
export function moduloBadgeClasses(modulo: ModuloVisual): string {
  const base = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none border";
  switch (modulo) {
    case "pcp": return `${base} bg-blue-50 text-blue-700 border-blue-200`;
    case "cop": return `${base} bg-green-50 text-green-700 border-green-200`;
    case "map": return `${base} bg-yellow-50 text-yellow-800 border-yellow-200`;
    case "sup": return `${base} bg-teal-50 text-teal-700 border-teal-200`;
    default: return `${base} bg-muted text-muted-foreground border-border`;
  }
}

/** Ponto colorido usado na sidebar. */
export function moduloDotClasses(modulo: ModuloVisual): string {
  const base = "inline-block h-2 w-2 rounded-full shrink-0";
  switch (modulo) {
    case "pcp": return `${base} bg-blue-500`;
    case "cop": return `${base} bg-green-600`;
    case "map": return `${base} bg-yellow-500`;
    case "sup": return `${base} bg-teal-600`;
    default: return `${base} bg-muted-foreground/40`;
  }
}

/** Classes do trigger de sub-aba quando ativo (cor do módulo). */
export function moduloTabClasses(modulo: ModuloVisual): string {
  switch (modulo) {
    case "pcp": return "data-[state=active]:bg-blue-600 data-[state=active]:text-white";
    case "cop": return "data-[state=active]:bg-green-600 data-[state=active]:text-white";
    case "map": return "data-[state=active]:bg-yellow-500 data-[state=active]:text-white";
    case "sup": return "data-[state=active]:bg-teal-600 data-[state=active]:text-white";
    default: return "";
  }
}

/** Normaliza texto para busca (minúsculo, sem acento). */
export function normalizarBusca(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
