// PDF "Faixas de quantidade por pedido" — resumo executivo em UMA página A4.
// Nenhum cálculo aqui: a tela passa as linhas já agregadas e este módulo só formata.
import logoJuff from "@/assets/loguinhojuffpreto.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoeda, fmtNum, type LinhaFaixaQtd } from "@/lib/indicadores-olist";

export interface TopModeloFaixa {
  nome: string;
  pecas: number;
}

export interface LinhaFaixaPdf extends LinhaFaixaQtd {
  precoMedio: number;
  topModelo: TopModeloFaixa | null;
}

export interface FaixasQtdPdfDados {
  periodo: { de: string; ate: string };
  filtros: {
    empresa: string;
    vendedores: string[];
    modelos: string[];
    cores: string[];
    tamanhos: string[];
    situacoes: string[];
    grupos: string[];
  };
  linhas: LinhaFaixaPdf[];
  totalTopModelo: TopModeloFaixa | null;
}

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const dataBR = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");

function agoraBR(): string {
  return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const num = (v: number) => `<td class="n">${esc(fmtNum(v))}</td>`;
const moeda = (v: number) => `<td class="n">${esc(fmtMoeda(v))}</td>`;
const perc = (v: number) =>
  `<td class="n">${esc(v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }))}%</td>`;

const modeloCel = (m: TopModeloFaixa | null) =>
  `<td class="l">${m ? `${esc(m.nome)} (${esc(fmtNum(m.pecas))} pçs)` : "—"}</td>`;

function filtrosTexto(f: FaixasQtdPdfDados["filtros"]): string {
  const lista = (rot: string, arr: string[]) => (arr.length ? `${rot}: ${arr.join(", ")}` : null);
  return [
    f.empresa && f.empresa !== "todas" ? `Empresa: ${f.empresa}` : null,
    lista("Vendedor", f.vendedores),
    lista("Modelo", f.modelos),
    lista("Cor", f.cores),
    lista("Tamanho", f.tamanhos),
    lista("Situação", f.situacoes),
    f.grupos.length ? `Grupos: ${f.grupos.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function corpoHtml(d: FaixasQtdPdfDados, gerador: string): string {
  const tPed = d.linhas.reduce((s, l) => s + l.pedidos, 0);
  const tPec = d.linhas.reduce((s, l) => s + l.pecas, 0);
  const tFat = d.linhas.reduce((s, l) => s + l.faturamento, 0);
  const tTicket = tPed ? tFat / tPed : 0;
  const tPreco = tPec ? tFat / tPec : 0;

  const head = [
    "Faixa",
    "Pedidos",
    "% pedidos",
    "Peças",
    "Faturamento",
    "% faturamento",
    "Ticket médio",
    "Preço médio/peça",
    "Modelo mais vendido",
  ];

  const rows = d.linhas
    .map(
      (l) =>
        `<tr><td class="l">${esc(l.label)}</td>${num(l.pedidos)}${perc(l.pctPedidos)}${num(
          l.pecas,
        )}${moeda(l.faturamento)}${perc(l.pctFaturamento)}${moeda(l.ticket)}${moeda(
          l.precoMedio,
        )}${modeloCel(l.topModelo)}</tr>`,
    )
    .join("");

  const total = `<tr class="tot"><td class="l">Total</td>${num(tPed)}${perc(tPed ? 100 : 0)}${num(
    tPec,
  )}${moeda(tFat)}${perc(tFat ? 100 : 0)}${moeda(tTicket)}${moeda(tPreco)}${modeloCel(
    d.totalTopModelo,
  )}</tr>`;

  return `
<header class="cab">
  <img src="${esc(logoJuff.url)}" alt="Juff" />
  <div class="titleblock">
    <div class="title">Faixas de quantidade por pedido</div>
    <div class="data">Juff Custom</div>
    <div class="data">${esc(dataBR(d.periodo.de))} a ${esc(dataBR(d.periodo.ate))}</div>
    <div class="meta">${esc(filtrosTexto(d.filtros))}</div>
  </div>
</header>

<table class="grid">
  <thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows}${total}</tbody>
</table>

<footer class="pe">Faixas de quantidade geradas em ${esc(agoraBR())} por ${esc(gerador)}</footer>
`;
}

export async function abrirFaixasQtdParaImpressao(d: FaixasQtdPdfDados) {
  const titulo = `faixas-quantidade-${d.periodo.de}-a-${d.periodo.ate}`;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const gerador = user?.email ?? user?.user_metadata?.name ?? "usuário desconhecido";

  const html = `<!doctype html>
<html lang="pt-br"><head>
<meta charset="utf-8" />
<title>${esc(titulo)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; color: #000; background: #fff; font-family: "Google Sans Flex", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  @page { size: A4 portrait; margin: 10mm; }
  .cab { display: flex; align-items: center; gap: 6mm; border-bottom: 1px solid #000; padding-bottom: 3mm; margin-bottom: 5mm; }
  .cab img { width: 18mm; height: 18mm; object-fit: contain; }
  .titleblock { flex: 1; display: flex; flex-direction: column; gap: 1mm; }
  .title { font-size: 20pt; font-weight: 700; line-height: 1.1; }
  .data { font-size: 12pt; font-weight: 700; }
  .meta { font-size: 8pt; color: #333; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  table.grid th, table.grid td { border: 1px solid #000; padding: 1.6mm 1.5mm; text-align: center; }
  table.grid th { font-weight: 700; font-size: 7.5pt; }
  table.grid td.l { text-align: left; }
  table.grid td.n { text-align: right; font-variant-numeric: tabular-nums; }
  table.grid tr.tot td { font-weight: 700; }
  table.grid tr { page-break-inside: avoid; break-inside: avoid; }
  footer.pe { border-top: 1px solid #000; margin-top: 5mm; padding-top: 2mm; font-size: 7.5pt; color: #333; }
  @media print { .noprint { display: none !important; } }
</style>
</head><body>
<div class="noprint" style="padding:8px 12px;background:#fff;border-bottom:1px solid #000;display:flex;gap:8px;align-items:center;">
  <strong>${esc(titulo)}.pdf</strong>
  <button onclick="window.print()" style="padding:4px 10px">Imprimir / Salvar como PDF</button>
  <span style="color:#000;font-size:12px">Use "Salvar como PDF" no diálogo de impressão.</span>
</div>
${corpoHtml(d, gerador)}
<script>setTimeout(()=>{ try { window.print(); } catch(e){} }, 350);</script>
</body></html>`;

  const w = window.open("", "_blank", "width=1000,height=1000");
  if (!w) {
    alert("Não foi possível abrir o popup do PDF. Habilite popups para esta página.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = titulo;
}
