import * as XLSX from "xlsx";
import { REFACAO_CORES, REFACAO_TAMANHOS } from "@/lib/pedidos";

export type EmpresaOlist = "JOKE" | "JUFF";

export interface ItemOlist {
  produto_olist: string;
  cor: string;
  tamanho: string;
  qtd: number;
}

export interface LinhaIgnorada {
  linha: number;
  produto: string;
  motivo: string;
}

export interface ResultadoParse {
  itens: ItemOlist[];
  ignoradas: LinhaIgnorada[];
  totalLinhas: number;
  /** produto_olist → linhas da planilha em que ele apareceu (para avisos de mapeamento) */
  linhasPorProduto: Record<string, number[]>;
}

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const TAM_SET = new Map<string, string>(REFACAO_TAMANHOS.map((t) => [semAcento(t), t]));
const COR_SET = new Map<string, string>(REFACAO_CORES.map((c) => [semAcento(c.nome), c.nome]));

/** Casa a cor da planilha com a cor canônica do COP (ignora acentos/caixa). */
export function normalizarCor(cor: string): string {
  return COR_SET.get(semAcento(cor)) ?? cor.trim();
}

export function normalizarTamanho(t: string): string | null {
  return TAM_SET.get(semAcento(t)) ?? null;
}

/**
 * "Modelo/Cor - Cor - Tamanho" → produto_olist (tudo antes da cor), cor, tamanho.
 * Último token = tamanho, penúltimo = cor, restante rejuntado = produto.
 */
export function parseProduto(str: string): { produto_olist: string; cor: string; tamanho: string } | string {
  const bruto = (str ?? "").trim();
  if (!bruto) return "Produto vazio";
  const partes = bruto.split(" - ").map((p) => p.trim()).filter((p) => p !== "");
  if (partes.length < 3) return "Formato inesperado (esperado Produto - Cor - Tamanho)";
  const tamanho = normalizarTamanho(partes[partes.length - 1]);
  if (!tamanho) return `Tamanho não reconhecido: "${partes[partes.length - 1]}"`;
  const cor = normalizarCor(partes[partes.length - 2]);
  const produto_olist = partes.slice(0, partes.length - 2).join(" - ");
  if (!produto_olist) return "Produto sem nome antes da cor";
  return { produto_olist, cor, tamanho };
}

function acharCampo(row: Record<string, unknown>, alvos: string[]): unknown {
  for (const k of Object.keys(row)) {
    const kn = semAcento(k);
    if (alvos.some((a) => kn === a || kn.includes(a))) return row[k];
  }
  return undefined;
}

/** Soma qtd por produto·cor·tamanho. */
export function agregarItens(itens: ItemOlist[]): ItemOlist[] {
  const m = new Map<string, ItemOlist>();
  for (const it of itens) {
    const k = `${it.produto_olist}|${it.cor}|${it.tamanho}`;
    const cur = m.get(k);
    if (cur) cur.qtd += it.qtd;
    else m.set(k, { ...it });
  }
  return Array.from(m.values());
}

export async function parsePlanilhaOlist(file: File): Promise<ResultadoParse> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const itens: ItemOlist[] = [];
  const ignoradas: LinhaIgnorada[] = [];
  const linhasPorProduto: Record<string, number[]> = {};

  rows.forEach((row, i) => {
    const produtoRaw = acharCampo(row, ["produto", "descricao"]);
    const qtdRaw = acharCampo(row, ["estoque atual", "estoque", "quantidade", "saldo"]);
    const produto = String(produtoRaw ?? "").trim();
    if (!produto) return;
    const parsed = parseProduto(produto);
    if (typeof parsed === "string") {
      ignoradas.push({ linha: i + 2, produto, motivo: parsed });
      return;
    }
    const qtdNum = Number(String(qtdRaw ?? "0").replace(/\./g, "").replace(",", "."));
    itens.push({ ...parsed, qtd: Number.isFinite(qtdNum) ? Math.trunc(qtdNum) : 0 });
    (linhasPorProduto[parsed.produto_olist] ??= []).push(i + 2);
  });

  return { itens: agregarItens(itens), ignoradas, totalLinhas: rows.length, linhasPorProduto };
}

export function empresaPeloNome(nome: string): EmpresaOlist | null {
  const n = semAcento(nome);
  if (n.includes("joke")) return "JOKE";
  if (n.includes("juff")) return "JUFF";
  return null;
}
