// FASE 6 — PDF do Painel de Indicadores.
// Reaproveita EXATAMENTE as agregações puras de indicadores-olist.ts (nenhum
// recálculo aqui): a tela passa o que já calculou e este módulo só apresenta.
import logoJuff from "@/assets/loguinhojuffpreto.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import {
  fmtMes,
  fmtMoeda,
  fmtNum,
  fmtPerc,
  variacao,
  type GradeCruzada,
  type LinhaABC,
  type LinhaChave,
  type LinhaCliente,
  type LinhaMes,
  type LinhaRanking,
  type LinhaUf,
  type LinhaVendedor,
  type ProdutividadePcp,
  type Resumo,
  type ResumoFrete,
  type SaudeCadastro,
  type VendidoProduzido,
} from "@/lib/indicadores-olist";

type ClienteAbc = LinhaCliente & { perc: number; acumulado: number; classe: string };

export interface IndicadoresPdfDados {
  /** "Juff Custom" | "Juff Store" — identifica o escopo no cabeçalho e no arquivo. */
  escopoLabel: string;
  periodo: { de: string; ate: string };
  comparar: boolean;
  periodoAnterior: { de: string; ate: string } | null;
  filtros: {
    empresa: string;
    vendedores: string[];
    modelos: string[];
    cores: string[];
    tamanhos: string[];
    situacoes: string[];
    grupos: string[];
  };
  resumo: Resumo;
  resumoAnterior: Resumo;
  mensal: LinhaMes[];
  situacoes: LinhaChave[];
  rankings: { titulo: string; linhas: LinhaRanking[] }[];
  gradeTamanho: GradeCruzada;
  gradeCor: GradeCruzada;
  abcModelo: LinhaABC[];
  clientes: ClienteAbc[];
  vendedores: LinhaVendedor[];
  frete: ResumoFrete;
  /** Seções exclusivas do escopo Custom: ausentes, não são renderizadas. */
  ufs?: LinhaUf[];
  vendidoProduzido?: VendidoProduzido;
  producao?: ProdutividadePcp;
  saude?: SaudeCadastro;
  /** Seções exclusivas do escopo Store: ausentes, não são renderizadas. */
  composicaoStore?: ComposicaoStore;
  rankingEstampas?: LinhaRanking[];
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
const perc = (v: number) => `<td class="n">${esc(v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }))}%</td>`;

function tabela(head: string[], rows: string[], vazio = "Sem dados no período."): string {
  if (rows.length === 0) {
    return `<table class="grid"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody><tr><td class="vazio" colspan="${head.length}">${esc(vazio)}</td></tr></tbody></table>`;
  }
  return `<table class="grid"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.join("")}</tbody></table>`;
}

function bloco(titulo: string, sub: string | null, corpo: string): string {
  return `<section class="bloco">
    <h2>${esc(titulo)}</h2>
    ${sub ? `<p class="sub">${esc(sub)}</p>` : ""}
    ${corpo}
  </section>`;
}

function kpis(d: IndicadoresPdfDados): string {
  const itens: { t: string; v: string; a: number }[] = [
    { t: "Faturamento", v: fmtMoeda(d.resumo.faturamento), a: d.resumoAnterior.faturamento },
    { t: "Pedidos", v: fmtNum(d.resumo.pedidos), a: d.resumoAnterior.pedidos },
    { t: "Peças vendidas", v: fmtNum(d.resumo.pecas), a: d.resumoAnterior.pecas },
    { t: "Ticket médio", v: fmtMoeda(d.resumo.ticket), a: d.resumoAnterior.ticket },
    { t: "Preço médio/peça", v: fmtMoeda(d.resumo.precoMedio), a: d.resumoAnterior.precoMedio },
  ];
  const atual = [d.resumo.faturamento, d.resumo.pedidos, d.resumo.pecas, d.resumo.ticket, d.resumo.precoMedio];
  return `<div class="kpis">${itens
    .map(
      (k, idx) => `<div class="kpi">
        <div class="kpi-t">${esc(k.t)}</div>
        <div class="kpi-v">${esc(k.v)}</div>
        ${d.comparar ? `<div class="kpi-d">${esc(fmtPerc(variacao(atual[idx]!, k.a)))} vs. anterior</div>` : ""}
      </div>`,
    )
    .join("")}</div>`;
}

function gradeHtml(g: GradeCruzada): string {
  const head = ["Modelo", "Total", ...g.colunas];
  const rows = g.linhas.map(
    (l) =>
      `<tr><td class="l">${esc(l.modelo)}</td>${num(l.total)}${g.colunas
        .map((c) => {
          const cel = l.celulas[c];
          return `<td class="n">${cel && cel.pecas ? `${esc(fmtNum(cel.pecas))} <span class="mut">(${esc(
            cel.perc.toLocaleString("pt-BR", { maximumFractionDigits: 0 }),
          )}%)</span>` : "—"}</td>`;
        })
        .join("")}</tr>`,
  );
  return tabela(head, rows);
}

function listaHtml(titulo: string, itens: string[]): string {
  return `<div class="lista"><strong>${esc(titulo)} (${itens.length})</strong>
    <div class="chips">${itens.length ? itens.map((i) => `<span>${esc(i)}</span>`).join("") : "<em>nenhum</em>"}</div></div>`;
}

function corpoHtml(d: IndicadoresPdfDados, gerador: string): string {
  const f = d.filtros;
  const lista = (label: string, arr: string[]) => (arr.length ? `${label}: ${arr.join(", ")}` : null);
  const filtrosTexto = [
    `Empresa: ${f.empresa === "CONSOLIDADO" ? "Consolidado" : f.empresa}`,
    lista("Vendedor", f.vendedores),
    lista("Modelo", f.modelos),
    lista("Cor", f.cores),
    lista("Tamanho", f.tamanhos),
    lista("Situação", f.situacoes),
    f.grupos.length ? `Grupos: ${f.grupos.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");


  return `
<header class="cab">
  <img src="${esc(logoJuff.url)}" alt="Juff" />
  <div class="titleblock">
    <div class="title">Painel de Indicadores</div>
    <div class="data">${esc(d.escopoLabel)}</div>
    <div class="data">${esc(dataBR(d.periodo.de))} a ${esc(dataBR(d.periodo.ate))}</div>
    <div class="meta">${esc(filtrosTexto)}</div>
    ${
      d.comparar && d.periodoAnterior
        ? `<div class="meta">Comparado com ${esc(dataBR(d.periodoAnterior.de))} a ${esc(dataBR(d.periodoAnterior.ate))}</div>`
        : ""
    }
  </div>
</header>

${bloco("Resumo", null, kpis(d))}

${bloco(
  "Rankings",
  "Ordenados por peças; participação e faturamento no período.",
  d.rankings
    .map((r) =>
      `<h3>${esc(r.titulo)}</h3>` +
      tabela(
        ["#", "Item", "Peças", "% peças", "Faturamento", "Pedidos"],
        r.linhas
          .slice(0, 20)
          .map(
            (l, i) =>
              `<tr><td class="n">${i + 1}</td><td class="l">${esc(l.chave)}</td>${num(l.pecas)}${perc(
                l.percPecas,
              )}${moeda(l.faturamento)}${num(l.pedidos)}</tr>`,
          ),
      ),
    )
    .join(""),
)}

${bloco("Tamanhos por modelo", "Peças e participação dentro de cada modelo.", gradeHtml(d.gradeTamanho))}
${bloco("Cores por modelo", "Peças e participação dentro de cada modelo.", gradeHtml(d.gradeCor))}

${bloco(
  "Faturamento",
  "Frete e despesas não entram no faturamento.",
  tabela(
    ["Mês", "Faturamento", "JOKE", "JUFF", "Pedidos", "Peças"],
    d.mensal.map(
      (m) =>
        `<tr><td class="l">${esc(fmtMes(m.mes))}</td>${moeda(m.faturamento)}${moeda(m.joke)}${moeda(
          m.juff,
        )}${num(m.pedidos)}${num(m.pecas)}</tr>`,
    ),
  ) +
    `<h3>Por situação</h3>` +
    tabela(
      ["Situação", "Pedidos", "Peças", "Faturamento", "%"],
      d.situacoes.map(
        (s) =>
          `<tr><td class="l">${esc(s.chave)}</td>${num(s.pedidos)}${num(s.pecas)}${moeda(s.faturamento)}${perc(
            s.perc,
          )}</tr>`,
      ),
    ),
)}

${bloco(
  "Curva ABC de modelo",
  "Produto sem mapeamento entra no faturamento, mas fica fora do ranking de modelo.",
  tabela(
    ["Modelo", "Peças", "Faturamento", "%", "Acumulado", "Classe"],
    d.abcModelo.map(
      (l) =>
        `<tr><td class="l">${esc(l.chave)}</td>${num(l.pecas)}${moeda(l.faturamento)}${perc(
          l.percFaturamento,
        )}${perc(l.acumulado)}<td class="n">${esc(l.classe)}</td></tr>`,
    ),
  ),
)}

${bloco(
  "Clientes",
  `Recorrentes: ${fmtNum(d.clientes.filter((c) => !c.novo).length)} · Novos: ${fmtNum(
    d.clientes.filter((c) => c.novo).length,
  )} — a primeira compra é apurada sobre o histórico completo.`,
  tabela(
    ["Cliente", "Pedidos", "Peças", "Faturamento", "%", "Acumulado", "Classe", "Tipo"],
    d.clientes
      .slice(0, 30)
      .map(
        (c) =>
          `<tr><td class="l">${esc(c.nome || c.cliente_id)}</td>${num(c.pedidos)}${num(c.pecas)}${moeda(
            c.faturamento,
          )}${perc(c.perc)}${perc(c.acumulado)}<td class="n">${esc(c.classe)}</td><td class="n">${
            c.novo ? "Novo" : "Recorrente"
          }</td></tr>`,
      ),
  ),
)}

${bloco(
  "Vendedores",
  "Desconto convertido para base única (reais e % equivalente sobre o subtotal).",
  tabela(
    ["Vendedor", "Pedidos", "Peças", "Faturamento", "Ticket médio", "Desconto R$", "Desconto %"],
    d.vendedores.map(
      (v) =>
        `<tr><td class="l">${esc(v.vendedor)}</td>${num(v.pedidos)}${num(v.pecas)}${moeda(v.faturamento)}${moeda(
          v.ticket,
        )}${moeda(v.descontoValor)}${perc(v.descontoPerc)}</tr>`,
    ),
  ),
)}

${d.ufs
  ? bloco(
      "Frete e distribuição por UF",
      `Total ${fmtMoeda(d.frete.total)} · médio por pedido ${fmtMoeda(d.frete.medio)} · ${d.frete.percComFrete.toLocaleString(
        "pt-BR",
        { maximumFractionDigits: 1 },
      )}% dos pedidos com frete cobrado. O frete nunca é somado ao faturamento. A UF vem sempre do PCP.`,
      tabela(
        ["UF", "Pedidos", "Peças", "Faturamento", "% receita", "Frete"],
        d.ufs.map(
          (u) =>
            `<tr><td class="l">${esc(u.uf)}</td>${num(u.pedidos)}${num(u.pecas)}${moeda(u.faturamento)}${perc(
              u.perc,
            )}${moeda(u.frete)}</tr>`,
        ),
      ),
    )
  : bloco(
      "Frete",
      `Total ${fmtMoeda(d.frete.total)} · médio por pedido ${fmtMoeda(d.frete.medio)} · ${d.frete.percComFrete.toLocaleString(
        "pt-BR",
        { maximumFractionDigits: 1 },
      )}% dos pedidos com frete cobrado. O frete nunca é somado ao faturamento.`,
      "",
    )}
${d.vendidoProduzido ? ((vxp) => bloco(
  "Vendido × Produzido",
  "Apenas pedidos casados (Olist + PCP). A diferença é esperada: perdas e refações fazem a produção superar a venda.",
  tabela(
    ["Período", "Pedidos", "Vendidas", "Produzidas", "Perdidas", "Diferença", "Dif. %"],
    [
      ...vxp.mensal.map(
        (m) =>
          `<tr><td class="l">${esc(fmtMes(m.chave))}</td>${num(m.pedidos)}${num(m.vendidas)}${num(
            m.produzidas,
          )}${num(m.perdidas)}${num(m.diferenca)}<td class="n">${esc(fmtPerc(m.difPerc))}</td></tr>`,
      ),
      `<tr class="tot"><td class="l">Total</td>${num(vxp.total.pedidos)}${num(
        vxp.total.vendidas,
      )}${num(vxp.total.produzidas)}${num(vxp.total.perdidas)}${num(
        vxp.total.diferenca,
      )}<td class="n">${esc(fmtPerc(vxp.total.difPerc))}</td></tr>`,
    ],
  ),
))(d.vendidoProduzido) : ""}
${d.producao ? ((p) => bloco(
  "Produção e prazo (somente PCP)",
  "Bloco exclusivamente PCP: não sofre recorte por empresa, modelo, cor, tamanho ou situação. O filtro de Vendedor vale e usa o vendedor cadastrado no PCP. Prazos em dias úteis, com feriados.",
  `<div class="kpis">
    <div class="kpi"><div class="kpi-t">Pedidos no período</div><div class="kpi-v">${esc(fmtNum(p.pedidos))}</div></div>
    <div class="kpi"><div class="kpi-t">Prazo médio (dias úteis)</div><div class="kpi-v">${
      p.prazoMedio == null ? "—" : esc(p.prazoMedio.toLocaleString("pt-BR", { maximumFractionDigits: 1 }))
    }</div></div>
    <div class="kpi"><div class="kpi-t">% no prazo</div><div class="kpi-v">${
      p.percNoPrazo == null ? "—" : `${esc(p.percNoPrazo.toLocaleString("pt-BR", { maximumFractionDigits: 1 }))}%`
    }</div></div>
    <div class="kpi"><div class="kpi-t">Atraso médio (dias)</div><div class="kpi-v">${
      p.atrasoMedio == null ? "—" : esc(p.atrasoMedio.toLocaleString("pt-BR", { maximumFractionDigits: 1 }))
    }</div></div>
    <div class="kpi"><div class="kpi-t">Gargalo</div><div class="kpi-v sm">${esc(p.gargalo ?? "—")}</div></div>
  </div>` +
    `<h3>Tempo médio por etapa</h3>` +
    tabela(
      ["Etapa", "Média (dias úteis)", "Pedidos"],
      p.etapas.map(
        (e) =>
          `<tr><td class="l">${esc(e.etapa)}</td><td class="n">${esc(
            e.media.toLocaleString("pt-BR", { maximumFractionDigits: 1 }),
          )}</td>${num(e.pedidos)}</tr>`,
      ),
    ) +
    `<h3>Atrasados (${p.atrasados.length})</h3>` +
    tabela(
      ["Pedido", "Entrega prevista", "Dias"],
      p.atrasados
        .slice(0, 40)
        .map((a) => `<tr><td class="l">${esc(a.pedido)}</td><td>${esc(dataBR(a.data_entrega))}</td>${num(a.dias)}</tr>`),
      "Nenhum pedido atrasado.",
    ) +
    `<h3>Em risco (${p.emRisco.length})</h3>` +
    tabela(
      ["Pedido", "Entrega prevista", "Dias"],
      p.emRisco
        .slice(0, 40)
        .map((a) => `<tr><td class="l">${esc(a.pedido)}</td><td>${esc(dataBR(a.data_entrega))}</td>${num(a.dias)}</tr>`),
      "Nenhum pedido em risco.",
    ) +
    `<h3>Refações por área</h3>` +
    tabela(
      ["Área", "Episódios", "Peças", "Perdidas"],
      p.refacoesPorArea.map(
        (a) => `<tr><td class="l">${esc(a.area)}</td>${num(a.episodios)}${num(a.pecas)}${num(a.perdidas)}</tr>`,
      ),
      "Nenhuma refação no período.",
    ) +
    `<h3>Correções de etapa</h3>` +
    tabela(
      ["Aba", "Correções"],
      p.correcoesPorAba.map((c) => `<tr><td class="l">${esc(c.aba)}</td>${num(c.qtd)}</tr>`),
      "Nenhuma correção no período.",
    ),
))(d.producao) : ""}
${d.saude ? ((sd) => bloco(
  "Saúde do cadastro",
  "Diagnóstico de cadastro — informativo, sem semântica de erro.",
  listaHtml("Somente na Olist", sd.soOlist.slice(0, 120)) +
    listaHtml("Somente no PCP", sd.soPcp.slice(0, 120)) +
    `<h3>Produtos sem mapeamento (${sd.semMapeamento.length})</h3>` +
    tabela(
      ["Produto Olist", "Peças", "Faturamento"],
      sd.semMapeamento.map(
        (s) => `<tr><td class="l">${esc(s.produto)}</td>${num(s.pecas)}${moeda(s.faturamento)}</tr>`,
      ),
      "Todos os produtos estão mapeados.",
    ) +
    `<h3>Divergências de quantidade (${sd.divergencias.length})</h3>` +
    tabela(
      ["Pedido", "Olist", "PCP", "Diferença"],
      sd.divergencias
        .slice(0, 60)
        .map(
          (v) =>
            `<tr><td class="l">${esc(v.pedido)}</td>${num(v.olist)}${num(v.pcp)}${num(v.diferenca)}</tr>`,
        ),
      "Nenhuma divergência.",
    ),
))(d.saude) : ""}
<footer class="pe">Painel de Indicadores gerado em ${esc(agoraBR())} por ${esc(gerador)}</footer>
`;
}

export async function abrirIndicadoresParaImpressao(d: IndicadoresPdfDados) {
  const slug = d.escopoLabel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const titulo = `indicadores${slug ? `-${slug}` : ""}-${d.periodo.de}-a-${d.periodo.ate}`;

  const { data: { user } } = await supabase.auth.getUser();
  const gerador = user?.email ?? user?.user_metadata?.name ?? "usuário desconhecido";

  const html = `<!doctype html>
<html lang="pt-br"><head>
<meta charset="utf-8" />
<title>${esc(titulo)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; color: #000; background: #fff; font-family: "Google Sans Flex", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  @page { size: A4 portrait; margin: 8mm; }
  .cab { display: flex; align-items: center; gap: 6mm; border-bottom: 1px solid #000; padding-bottom: 3mm; margin-bottom: 4mm; }
  .cab img { width: 18mm; height: 18mm; object-fit: contain; }
  .titleblock { flex: 1; display: flex; flex-direction: column; gap: 1mm; }
  .title { font-size: 22pt; font-weight: 700; line-height: 1; }
  .data { font-size: 14pt; font-weight: 700; }
  .meta { font-size: 8pt; color: #333; }
  section.bloco { margin: 0 0 6mm; break-inside: auto; }
  h2 { font-size: 12pt; margin: 0 0 1mm; border-bottom: 1px solid #000; padding-bottom: 1mm; }
  h3 { font-size: 9pt; margin: 3mm 0 1mm; }
  p.sub { font-size: 8pt; color: #333; margin: 0 0 2mm; }
  .kpis { display: flex; flex-wrap: wrap; gap: 2mm; margin-bottom: 2mm; }
  .kpi { flex: 1 1 30mm; border: 1px solid #000; padding: 2mm; }
  .kpi-t { font-size: 7pt; text-transform: uppercase; letter-spacing: .3px; }
  .kpi-v { font-size: 13pt; font-weight: 700; font-variant-numeric: tabular-nums; }
  .kpi-v.sm { font-size: 10pt; }
  .kpi-d { font-size: 7pt; color: #333; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 2mm; }
  table.grid th, table.grid td { border: 1px solid #000; padding: 1mm 1.5mm; text-align: center; }
  table.grid thead { display: table-header-group; }
  table.grid tr { page-break-inside: avoid; break-inside: avoid; }
  table.grid th { font-weight: 700; font-size: 7.5pt; white-space: nowrap; }
  table.grid td.l { text-align: left; }
  table.grid td.n { text-align: right; font-variant-numeric: tabular-nums; }
  table.grid tr.tot td { font-weight: 700; }
  td.vazio { text-align: center; color: #333; padding: 3mm; }
  .mut { color: #555; font-size: 7pt; }
  .lista { font-size: 8pt; margin-bottom: 2mm; }
  .chips { margin-top: 1mm; display: flex; flex-wrap: wrap; gap: 1mm; }
  .chips span { border: 1px solid #000; padding: 0.3mm 1.2mm; font-variant-numeric: tabular-nums; }
  footer.pe { border-top: 1px solid #000; margin-top: 4mm; padding-top: 2mm; font-size: 7.5pt; color: #333; }
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
