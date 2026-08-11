// Parser puro do XML da NF-e (padrão SEFAZ 4.00). Sem React, sem Supabase.

import { SUP_CONDICOES_PAGAMENTO } from "@/lib/sup";

export type NFeEmitente = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  ie: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
};

export type NFeItem = {
  nItem: number;
  cProd: string;
  xProd: string;
  ncm: string | null;
  cfop: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  vDesc: number | null;
};

export type NFeNota = {
  chave: string | null;
  numero: string | null;
  serie: string | null;
  emissao: string | null;
  natureza: string | null;
  vencimentos: string[];
};

export type NFeParsed = { emitente: NFeEmitente; nota: NFeNota; itens: NFeItem[] };

function filhos(el: Element | Document, tag: string): Element[] {
  return Array.from(el.getElementsByTagName(tag)) as Element[];
}

function txt(el: Element | null | undefined, tag: string): string | null {
  if (!el) return null;
  const found = el.getElementsByTagName(tag)[0];
  const v = found?.textContent?.trim();
  return v ? v : null;
}

function num(el: Element | null | undefined, tag: string, fallback: number | null): number | null {
  const t = txt(el, tag);
  if (t == null) return fallback;
  const v = Number(t);
  return Number.isFinite(v) ? v : fallback;
}

export function soDigitos(s: string | null | undefined): string {
  return String(s ?? "").replace(/\D/g, "");
}

export function normalizarNome(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseNFe(xmlText: string): NFeParsed {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Arquivo XML inválido.");
  }
  const inf = doc.getElementsByTagName("infNFe")[0] as Element | undefined;
  const emit = inf?.getElementsByTagName("emit")[0] as Element | undefined;
  if (!inf || !emit) throw new Error("Não parece um XML de NF-e.");

  const ender = emit.getElementsByTagName("enderEmit")[0] as Element | undefined;
  const emitente: NFeEmitente = {
    cnpj: soDigitos(txt(emit, "CNPJ") ?? txt(emit, "CPF")),
    razao_social: txt(emit, "xNome") ?? "",
    nome_fantasia: txt(emit, "xFant"),
    ie: txt(emit, "IE"),
    logradouro: txt(ender, "xLgr"),
    numero: txt(ender, "nro"),
    bairro: txt(ender, "xBairro"),
    cidade: txt(ender, "xMun"),
    uf: txt(ender, "UF"),
    cep: txt(ender, "CEP"),
    telefone: txt(ender, "fone"),
  };

  const ide = inf.getElementsByTagName("ide")[0] as Element | undefined;
  const dh = txt(ide, "dhEmi") ?? txt(ide, "dEmi");
  const idAttr = inf.getAttribute("Id") ?? "";
  const cobr = inf.getElementsByTagName("cobr")[0] as Element | undefined;
  const vencimentos = cobr
    ? filhos(cobr, "dup")
        .map((d) => txt(d, "dVenc"))
        .filter((v): v is string => !!v)
        .map((v) => v.slice(0, 10))
    : [];

  const nota: NFeNota = {
    chave: idAttr ? idAttr.replace(/^NFe/i, "") : null,
    numero: txt(ide, "nNF"),
    serie: txt(ide, "serie"),
    emissao: dh ? dh.slice(0, 10) : null,
    natureza: txt(ide, "natOp"),
    vencimentos,
  };

  const itens: NFeItem[] = filhos(inf, "det").map((det, i) => {
    const prod = det.getElementsByTagName("prod")[0] as Element | undefined;
    return {
      nItem: Number(det.getAttribute("nItem")) || i + 1,
      cProd: txt(prod, "cProd") ?? "",
      xProd: txt(prod, "xProd") ?? "",
      ncm: txt(prod, "NCM"),
      cfop: txt(prod, "CFOP") ?? "",
      uCom: txt(prod, "uCom") ?? "",
      qCom: num(prod, "qCom", 0) as number,
      vUnCom: num(prod, "vUnCom", 0) as number,
      vProd: num(prod, "vProd", 0) as number,
      vDesc: num(prod, "vDesc", null),
    };
  });

  return { emitente, nota, itens };
}

const DE_PARA_UNIDADE: Record<string, string> = {
  UN: "unidade", UNID: "unidade", UND: "unidade", UNIDADE: "unidade",
  PC: "peça", PÇ: "peça", PECA: "peça", PEÇA: "peça",
  KG: "kg", QUILO: "kg",
  // "LT" é ambíguo (lata × litro) → não mapeia, o usuário escolhe.
  L: "litro", LITRO: "litro", LITROS: "litro",
  MT: "metro", M: "metro", METRO: "metro", ML: "metro",
  RL: "rolo", ROLO: "rolo",
  BB: "bobina", BOB: "bobina", BOBINA: "bobina",
  CX: "caixa", CAIXA: "caixa",
  PCT: "pacote", PACOTE: "pacote", FD: "pacote", FARDO: "pacote",
  GL: "galão", GAL: "galão", GALAO: "galão", GALÃO: "galão",
  BD: "balde", BALDE: "balde",
  FR: "frasco", FRASCO: "frasco",
  LATA: "lata",
  SC: "saco", SACO: "saco", SACA: "saco",
};

/** "Un" → "unidade". Só devolve valor que exista na lista de unidades configurada. */
export function mapearUnidadeNFe(uCom: string, unidades: string[]): string {
  const chave = String(uCom ?? "").replace(/[.\s]/g, "").toUpperCase();
  const alvo = DE_PARA_UNIDADE[chave] ?? "";
  if (!alvo) return "";
  return unidades.includes(alvo) ? alvo : "";
}

function diasEntre(a: string, b: string): number {
  const da = new Date(`${a}T12:00:00`).getTime();
  const db = new Date(`${b}T12:00:00`).getTime();
  return Math.round((db - da) / 86_400_000);
}

/** Deriva condição de pagamento a partir da emissão e dos vencimentos. */
export function condicaoPagamentoNFe(emissao: string | null, vencimentos: string[]): string | null {
  if (!emissao || vencimentos.length === 0) return null;
  const dias = vencimentos.map((v) => diasEntre(emissao, v)).sort((x, y) => x - y);
  if (dias.length === 1) {
    const d = dias[0];
    if (d <= 1) return "À vista";
    const opcoes = [7, 15, 28, 30];
    const perto = opcoes.reduce((best, o) => (Math.abs(o - d) < Math.abs(best - d) ? o : best), opcoes[0]);
    if (Math.abs(perto - d) <= 3) {
      const label = `${perto} dias`;
      return (SUP_CONDICOES_PAGAMENTO as readonly string[]).includes(label) ? label : null;
    }
    return null;
  }
  const combo = dias.join("/");
  return (SUP_CONDICOES_PAGAMENTO as readonly string[]).includes(combo) ? combo : null;
}

const CFOP_COMPRA = new Set([
  "101", "102", "103", "104", "105", "106", "109", "110", "111", "113", "116",
  "117", "118", "119", "120", "122", "123", "401", "402", "403", "404", "405",
  "551", "552", "556",
]);

/** CFOP de venda de mercadoria → vem marcado por padrão na importação. */
export function cfopEhCompra(cfop: string): boolean {
  const s = soDigitos(cfop);
  return CFOP_COMPRA.has(s.slice(-3));
}

const CFOP_ROTULO: Record<string, string> = {
  "925": "Industrialização/Retorno", "926": "Industrialização/Retorno",
  "924": "Industrialização/Retorno", "901": "Industrialização/Retorno",
  "902": "Industrialização/Retorno", "903": "Industrialização/Retorno",
  "904": "Industrialização/Retorno", "905": "Industrialização/Retorno",
  "906": "Industrialização/Retorno", "907": "Industrialização/Retorno",
  "152": "Transferência", "151": "Transferência", "155": "Transferência",
  "201": "Devolução", "202": "Devolução", "410": "Devolução", "411": "Devolução",
  "912": "Remessa", "913": "Remessa", "914": "Remessa", "915": "Remessa",
  "916": "Remessa", "917": "Remessa", "920": "Remessa", "921": "Remessa",
  "922": "Remessa", "923": "Remessa",
};

/** Rótulo curto do que é a linha quando não é compra. */
export function rotuloCfop(cfop: string): string {
  const s = soDigitos(cfop).slice(-3);
  return CFOP_ROTULO[s] ?? "Outro";
}

// ─────────────────────────────────────────────────────────────────────────────
// Nota de industrialização (tinturaria)
// ─────────────────────────────────────────────────────────────────────────────

/** CFOP 5125/6125 — industrialização efetuada para outra empresa. */
export function cfopEhIndustrializacao(cfop: string): boolean {
  return soDigitos(cfop).slice(-3) === "125";
}

const CFOP_RETORNO_IND = new Set([
  "924", "925", "926", "901", "902", "903", "904", "905", "906", "907",
]);

/** CFOP de retorno de material do cliente (não entra no cadastro). */
export function cfopEhRetornoIndustrializacao(cfop: string): boolean {
  return CFOP_RETORNO_IND.has(soDigitos(cfop).slice(-3));
}

/** A nota é de industrialização quando algum item tem CFOP terminando em 125. */
export function notaEhIndustrializacao(itens: NFeItem[]): boolean {
  return itens.some((it) => cfopEhIndustrializacao(it.cfop));
}

/** "C20869V2587" + "Cod Prod 250209 Lote=3570/2 AMARELO CANARIO" → { numero, nome }. */
export function extrairCorItem(
  cProd: string,
  xProd: string,
): { numero: string; nome: string } | null {
  const m = /^C(\d+)V(\d+)$/i.exec(String(cProd ?? "").trim());
  if (!m) return null;
  const nome = String(xProd ?? "")
    .replace(/cod\s*prod\s*\d+/i, " ")
    .replace(/lote\s*=\s*\S+/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { numero: m[1], nome };
}

/** Rótulo do valor da variação Cor. */
export function rotuloCor(numero: string, nome: string): string {
  return `${numero} - ${nome}`.trim();
}

export type IndCor = {
  numero: string;
  nome: string;
  rotulo: string;
  codTingimento: string;
  qtdTingimento: number;
  precoTingimento: number;
  codMaoObra: string | null;
  qtdMaoObra: number;
  precoMaoObra: number | null;
  uCom: string;
};

export type NotaIndustrializacao = {
  cores: IndCor[];
  retorno: NFeItem[];
  naoIdentificados: NFeItem[];
};

/** Consolida a nota de industrialização por cor. Lote nunca aparece na saída. */
export function agruparNotaIndustrializacao(itens: NFeItem[]): NotaIndustrializacao {
  const retorno = itens.filter((it) => cfopEhRetornoIndustrializacao(it.cfop));
  const naoIdentificados: NFeItem[] = [];
  const ordenados = itens
    .filter((it) => cfopEhIndustrializacao(it.cfop))
    .slice()
    .sort((a, b) => a.nItem - b.nItem);

  type Acc = IndCor & { _nItemTing: number; _nItemMo: number };
  const mapa = new Map<string, Acc>();
  let corrente: { chave: string; qtd: number } | null = null;

  for (const it of ordenados) {
    const cor = extrairCorItem(it.cProd, it.xProd);
    if (cor) {
      const chave = `${cor.numero}||${normalizarNome(cor.nome)}`;
      const atual = mapa.get(chave);
      if (atual) {
        atual.qtdTingimento += n(it.qCom);
        if (it.nItem >= atual._nItemTing) {
          atual._nItemTing = it.nItem;
          atual.precoTingimento = n(it.vUnCom);
        }
      } else {
        mapa.set(chave, {
          numero: cor.numero,
          nome: cor.nome,
          rotulo: rotuloCor(cor.numero, cor.nome),
          codTingimento: it.cProd,
          qtdTingimento: n(it.qCom),
          precoTingimento: n(it.vUnCom),
          codMaoObra: null,
          qtdMaoObra: 0,
          precoMaoObra: null,
          uCom: it.uCom,
          _nItemTing: it.nItem,
          _nItemMo: -1,
        });
      }
      corrente = { chave, qtd: n(it.qCom) };
      continue;
    }
    const acc = corrente ? mapa.get(corrente.chave) : null;
    if (!acc || !corrente || n(it.qCom) !== corrente.qtd) {
      naoIdentificados.push(it);
      continue;
    }
    acc.codMaoObra = it.cProd || acc.codMaoObra;
    acc.qtdMaoObra += n(it.qCom);
    if (it.nItem >= acc._nItemMo) {
      acc._nItemMo = it.nItem;
      acc.precoMaoObra = n(it.vUnCom);
    }
  }

  const cores: IndCor[] = Array.from(mapa.values()).map(
    ({ _nItemTing, _nItemMo, ...c }) => c,
  );
  return { cores, retorno, naoIdentificados };
}
