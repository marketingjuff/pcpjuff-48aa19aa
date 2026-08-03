import * as XLSX from "xlsx";
import JSZip from "jszip";
import { parseProduto, type EmpresaOlist } from "@/lib/estoque-olist";
import { isItemJuffStore } from "@/lib/indicadores-olist";
import { parseProdutoStore } from "@/lib/indicadores-store";
import { VENDEDORES } from "@/lib/pedidos";


export type { EmpresaOlist };

export interface PedidoOlistParsed {
  numero_pedido: string;
  data: string | null;
  data_prevista: string | null;
  nome_contato: string | null;
  cpf_cnpj: string | null;
  situacao: string | null;
  vendedor: string;
  vendedor_original: string | null;
  desconto_valor: number | null;
  desconto_percentual: number | null;
  desconto_original: string | null;
  frete: number;
  despesas: number;
}

export interface ItemOlistParsed {
  numero_pedido: string;
  descricao_original: string;
  produto_olist: string | null;
  cor: string | null;
  tamanho: string | null;
  qtd: number;
  valor_unitario: number;
  desconto_item: number;
  is_servico: boolean;
}

/** Recorte informativo dos itens "Juff Store" encontrados na importação. */
export interface ResumoStoreImport {
  pedidos: number;
  linhas: number;
  pecas: number;
  descricoes: string[];
  /** Descrições que o parser da Store não reconheceu por completo. */
  foraPadrao: { descricao: string; motivo: string }[];
}

/** Pedido cujo desconto não passou na checagem de sanidade da prévia (informativo). */
export interface PedidoDescontoSuspeito {
  numero_pedido: string;
  subtotal: number;
  desconto: number;
  liquido: number;
  motivo: string;
}

export interface ResultadoImportacaoVendas {
  arquivosLidos: number;
  totalLinhas: number;
  pedidos: PedidoOlistParsed[];
  itens: ItemOlistParsed[];
  produtosSemMapeamento: string[];
  servicos: string[];
  linhasIgnoradas: { arquivo: string; linha: number; motivo: string }[];
  /** Pedidos com ao menos um item Juff Store — ficam fora da conferência com o PCP. */
  pedidosStore: string[];
  store: ResumoStoreImport;
  /** Conferência não bloqueante: descontos maiores que o subtotal ou rateio divergente. */
  pedidosDescontoSuspeito: PedidoDescontoSuspeito[];
}



function semAcento(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Aceita número nativo (503.99), texto BR ("41,26" / "1.234,56") ou texto com ponto decimal ("503.99"). */
export function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const limpo = s.replace(/[^\d,.-]/g, "");
  if (!limpo) return 0;
  let normalizado: string;
  if (limpo.includes(",")) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) {
    normalizado = limpo.replace(/\./g, "");
  } else {
    normalizado = limpo;
  }
  return Number(normalizado) || 0;
}


/** DD/MM/AAAA (ou serial/Date do Excel) → AAAA-MM-DD. */
export function dataBr(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const ano = y.length === 2 ? `20${y}` : y;
    return `${ano}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

/** "WANDER LESKOVAR - JUFF" → "Wander" (casa com VENDEDORES) ou "Outros". */
export function normalizarVendedor(bruto: unknown): string {
  const s = String(bruto ?? "").trim();
  if (!s) return "Outros";
  const antesDoTraco = s.split("-")[0].trim();
  const primeiro = semAcento(antesDoTraco.split(/\s+/)[0] ?? "");
  const achou = VENDEDORES.find((v) => semAcento(v) === primeiro);
  return achou ?? "Outros";
}

/** Desconto do pedido: número nativo → valor direto; "13%" → percentual; "0,00" → valor em reais. */
export function parseDesconto(v: unknown): {
  desconto_valor: number | null;
  desconto_percentual: number | null;
  desconto_original: string | null;
} {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return { desconto_valor: null, desconto_percentual: null, desconto_original: null };
    return { desconto_valor: v, desconto_percentual: null, desconto_original: String(v) };
  }
  const s = String(v ?? "").trim();
  if (!s) return { desconto_valor: null, desconto_percentual: null, desconto_original: null };
  if (s.includes("%")) {
    return { desconto_valor: null, desconto_percentual: num(s), desconto_original: s };
  }
  return { desconto_valor: num(s), desconto_percentual: null, desconto_original: s };
}


function campo(row: Record<string, unknown>, alvos: string[]): unknown {
  const keys = Object.keys(row);
  for (const alvo of alvos) {
    const exato = keys.find((k) => semAcento(k) === alvo);
    if (exato !== undefined) return row[exato];
  }
  for (const alvo of alvos) {
    const parcial = keys.find((k) => semAcento(k).includes(alvo));
    if (parcial !== undefined) return row[parcial];
  }
  return undefined;
}

function txt(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function lerPlanilha(
  buf: ArrayBuffer,
  arquivo: string,
  acc: {
    pedidos: Map<string, PedidoOlistParsed>;
    itens: ItemOlistParsed[];
    servicos: Set<string>;
    produtos: Set<string>;
    ignoradas: ResultadoImportacaoVendas["linhasIgnoradas"];
    rateio: Map<string, number>;
    temRateio: boolean;
  },
): number {

  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return 0;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  rows.forEach((row, i) => {
    const linha = i + 2;
    const numero = String(campo(row, ["numero do pedido", "numero pedido", "numero"]) ?? "").trim();
    if (!numero) {
      acc.ignoradas.push({ arquivo, linha, motivo: "Número do pedido vazio" });
      return;
    }

    if (!acc.pedidos.has(numero)) {
      const vendedorOriginal = txt(campo(row, ["vendedor"]));
      const desc = parseDesconto(campo(row, ["desconto do pedido", "desconto pedido"]));
      acc.pedidos.set(numero, {
        numero_pedido: numero,
        data: dataBr(campo(row, ["data"])),
        data_prevista: dataBr(campo(row, ["data prevista"])),
        nome_contato: txt(campo(row, ["nome do contato", "nome contato"])),
        cpf_cnpj: txt(campo(row, ["cpf/cnpj", "cpf cnpj", "cnpj"])),
        situacao: txt(campo(row, ["situacao"])),
        vendedor: normalizarVendedor(vendedorOriginal),
        vendedor_original: vendedorOriginal,
        ...desc,
        frete: num(campo(row, ["frete pedido", "frete"])),
        despesas: num(campo(row, ["despesas pedido", "despesas"])),
      });
    }

    const rateadoBruto = campo(row, ["desconto do pedido rateado", "desconto pedido rateado"]);
    if (rateadoBruto !== undefined && String(rateadoBruto ?? "").trim() !== "") {
      acc.temRateio = true;
      acc.rateio.set(numero, (acc.rateio.get(numero) ?? 0) + num(rateadoBruto));
    }



    const descricao = String(campo(row, ["descricao"]) ?? "").trim();
    if (!descricao) {
      acc.ignoradas.push({ arquivo, linha, motivo: "Descrição vazia" });
      return;
    }
    const qtd = Math.trunc(num(campo(row, ["quantidade"])));
    const valor_unitario = num(campo(row, ["valor unitario"]));
    const desconto_item = num(campo(row, ["desconto item", "desconto do item"]));

    const parsed = parseProduto(descricao);
    if (typeof parsed === "string") {
      acc.servicos.add(descricao);
      acc.itens.push({
        numero_pedido: numero,
        descricao_original: descricao,
        produto_olist: null,
        cor: null,
        tamanho: null,
        qtd,
        valor_unitario,
        desconto_item,
        is_servico: true,
      });
      return;
    }

    acc.produtos.add(parsed.produto_olist);
    acc.itens.push({
      numero_pedido: numero,
      descricao_original: descricao,
      produto_olist: parsed.produto_olist,
      cor: parsed.cor,
      tamanho: parsed.tamanho,
      qtd,
      valor_unitario,
      desconto_item,
      is_servico: false,
    });
  });

  return rows.length;
}

/**
 * Lê um .zip (ou um .xls solto) com as planilhas de pedidos da Olist.
 * `mapeados` = produtos já presentes em olist_produto_map, para apontar pendências.
 */
export async function parseVendasOlist(
  file: File,
  mapeados: Set<string> = new Set(),
): Promise<ResultadoImportacaoVendas> {
  const acc = {
    pedidos: new Map<string, PedidoOlistParsed>(),
    itens: [] as ItemOlistParsed[],
    servicos: new Set<string>(),
    produtos: new Set<string>(),
    ignoradas: [] as ResultadoImportacaoVendas["linhasIgnoradas"],
    rateio: new Map<string, number>(),
    temRateio: false,

  };

  let arquivosLidos = 0;
  let totalLinhas = 0;
  const nome = file.name.toLowerCase();

  if (nome.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entradas = Object.values(zip.files)
      .filter((f) => !f.dir && /\.xlsx?$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
    if (entradas.length === 0) throw new Error("Nenhum arquivo .xls encontrado dentro do zip.");
    for (const entrada of entradas) {
      const buf = await entrada.async("arraybuffer");
      totalLinhas += lerPlanilha(buf, entrada.name, acc);
      arquivosLidos++;
    }
  } else {
    totalLinhas += lerPlanilha(await file.arrayBuffer(), file.name, acc);
    arquivosLidos = 1;
  }

  /* Juff Store: corte por pedido inteiro, igual à regra do painel. */
  const pedidosStoreSet = new Set<string>();
  for (const i of acc.itens) {
    if (isItemJuffStore(i.descricao_original) || isItemJuffStore(i.produto_olist)) {
      pedidosStoreSet.add(i.numero_pedido);
    }
  }

  const descricoesStore = new Set<string>();
  const foraPadraoMap = new Map<string, { descricao: string; motivo: string }>();
  let linhasStore = 0;
  let pecasStore = 0;
  const produtosStore = new Set<string>();
  for (const i of acc.itens) {
    if (!pedidosStoreSet.has(i.numero_pedido)) continue;
    if (i.produto_olist) produtosStore.add(i.produto_olist);
    if (i.is_servico) continue;
    linhasStore += 1;
    pecasStore += i.qtd;
    const desc = (i.descricao_original ?? "").trim();
    descricoesStore.add(desc);
    const ps = parseProdutoStore(desc);
    if (!ps.ok && !foraPadraoMap.has(desc)) {
      foraPadraoMap.set(desc, { descricao: desc, motivo: ps.motivo ?? "Fora do padrão" });
    }
  }

  /* Produto de pedido Store não exige de-para: a classificação é própria. */
  const produtosSemMapeamento = Array.from(acc.produtos)
    .filter((p) => !mapeados.has(p) && !produtosStore.has(p))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  /* Conferência de sanidade do desconto — informativa, nunca bloqueia a gravação. */
  const subtotalPorPedido = new Map<string, number>();
  for (const i of acc.itens) {
    const bruto = i.qtd * i.valor_unitario - i.desconto_item;
    subtotalPorPedido.set(i.numero_pedido, (subtotalPorPedido.get(i.numero_pedido) ?? 0) + bruto);
  }
  const pedidosDescontoSuspeito: PedidoDescontoSuspeito[] = [];
  for (const p of acc.pedidos.values()) {
    const subtotal = subtotalPorPedido.get(p.numero_pedido) ?? 0;
    const desconto =
      p.desconto_valor != null
        ? p.desconto_valor
        : p.desconto_percentual != null
          ? (subtotal * p.desconto_percentual) / 100
          : 0;
    const liquido = subtotal - desconto + p.frete + p.despesas;
    const motivos: string[] = [];
    if (desconto > subtotal) motivos.push("desconto maior que o valor dos itens");
    if (liquido < 0) motivos.push("líquido negativo");
    if (acc.temRateio && p.desconto_valor != null) {
      const somaRateio = acc.rateio.get(p.numero_pedido);
      if (somaRateio != null && Math.abs(somaRateio - p.desconto_valor) > 0.05) {
        motivos.push(`rateio soma ${somaRateio.toFixed(2)}`);
      }
    }
    if (motivos.length > 0) {
      pedidosDescontoSuspeito.push({
        numero_pedido: p.numero_pedido,
        subtotal,
        desconto,
        liquido,
        motivo: motivos.join(" · "),
      });
    }
  }
  pedidosDescontoSuspeito.sort((a, b) => a.numero_pedido.localeCompare(b.numero_pedido, "pt-BR", { numeric: true }));

  return {
    arquivosLidos,
    totalLinhas,
    pedidos: Array.from(acc.pedidos.values()),
    itens: acc.itens,
    produtosSemMapeamento,
    servicos: Array.from(acc.servicos).sort((a, b) => a.localeCompare(b, "pt-BR")),
    linhasIgnoradas: acc.ignoradas,
    pedidosStore: Array.from(pedidosStoreSet).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })),
    store: {
      pedidos: pedidosStoreSet.size,
      linhas: linhasStore,
      pecas: pecasStore,
      descricoes: Array.from(descricoesStore).sort((a, b) => a.localeCompare(b, "pt-BR")),
      foraPadrao: [...foraPadraoMap.values()].sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR")),
    },
    pedidosDescontoSuspeito,
  };

}

/* ------------------------------------------------------------------ */
/* Versão vigente: para cada pedido, o registro do lote mais recente.  */
/* ------------------------------------------------------------------ */

export interface ComLote {
  numero_pedido: string;
  lote_id: string;
}

/** Mapa lote_id → importado_em (ISO), usado para escolher a versão vigente. */
export type LotesPorData = Record<string, string>;

/** Filtra registros mantendo apenas a versão vigente de cada pedido. */
export function apenasVigentes<T extends ComLote>(registros: T[], lotes: LotesPorData): T[] {
  const melhorLote = new Map<string, string>();
  for (const r of registros) {
    const atual = melhorLote.get(r.numero_pedido);
    if (!atual || (lotes[r.lote_id] ?? "") > (lotes[atual] ?? "")) melhorLote.set(r.numero_pedido, r.lote_id);
  }
  return registros.filter((r) => melhorLote.get(r.numero_pedido) === r.lote_id);
}
