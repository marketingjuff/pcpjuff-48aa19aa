// PDF do Pedido de Compra (SUP) via janela de impressão — documento externo.
// NÃO exibe preço de tabela, economia ou comissão.
import logoJuff from "@/assets/loguinhojuffpreto.png.asset.json";
import type { SupFornecedor, SupPedidoCompra, SupPedidoItem, SupProduto } from "@/lib/sup";
import { SUP_EMPRESA_LABEL, fmtDataBR, fmtMoeda, fmtQtd, n, subtotalNegociado } from "@/lib/sup";

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function abrirPdfPedidoCompra(args: {
  pedido: SupPedidoCompra;
  fornecedor: SupFornecedor | null;
  itens: SupPedidoItem[];
  produtos: SupProduto[];
  modo?: "pedido" | "orcamento";
}) {
  const { pedido, fornecedor, itens, produtos } = args;
  const modo = args.modo ?? "pedido";
  const orcamento = modo === "orcamento";
  const nomeProduto = (id: string) => produtos.find((p) => p.id === id)?.nome ?? "—";
  const subtotal = subtotalNegociado(itens);
  const titulo = orcamento
    ? `PedidoOrcamento-${pedido.numero ?? "s-numero"}`
    : `PedidoCompra-${pedido.numero ?? "rascunho"}`;

  const nCols = orcamento ? 4 : 6;
  const linhas = itens.length === 0
    ? `<tr><td colspan="${nCols}" style="text-align:center">Sem itens</td></tr>`
    : itens.map((i, idx) => `<tr>
        <td class="num">${idx + 1}</td>
        <td>${esc(nomeProduto(i.produto_id))}</td>
        <td class="num">${esc(fmtQtd(i.quantidade))}</td>
        <td class="num">${esc(i.unidade)}</td>
        ${orcamento ? "" : `<td class="num">${esc(fmtMoeda(i.preco_negociado))}</td>
        <td class="num">${esc(fmtMoeda(n(i.preco_negociado) * n(i.quantidade)))}</td>`}
      </tr>`).join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>${esc(titulo)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; color: #000; margin: 0; }
  header { display: flex; align-items: center; gap: 4mm; border-bottom: 1px solid #000; padding-bottom: 3mm; margin-bottom: 4mm; }
  header img { width: 16mm; height: 16mm; object-fit: cover; border-radius: 2mm; }
  .t1 { font-size: 15pt; font-weight: 800; }
  .t2 { font-size: 10pt; margin-top: 1mm; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; font-size: 10pt; margin-bottom: 4mm; }
  .box { border: 1px solid #000; padding: 2.5mm; }
  .box b { display: inline-block; min-width: 34mm; }
  table.itens { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  table.itens th, table.itens td { border: 1px solid #000; padding: 1mm 1.5mm; }
  table.itens th { text-align: left; font-weight: 800; }
  table.itens .num { text-align: center; }
  tfoot td { font-weight: 800; }
  .obs { margin-top: 4mm; font-size: 10pt; white-space: pre-wrap; }
  @media print { .noprint { display: none !important; } }
</style>
</head><body>
<div class="noprint" style="padding:8px 12px;border-bottom:1px solid #000;display:flex;gap:8px;align-items:center;">
  <strong>${esc(titulo)}.pdf</strong>
  <button onclick="window.print()" style="padding:4px 10px">Imprimir / Salvar como PDF</button>
</div>
<header>
  <img src="${esc(logoJuff.url)}" alt="Juff" />
  <div>
    <div class="t1">Pedido de Compra ${esc(pedido.numero ?? "(rascunho)")}</div>
    <div class="t2">Empresa: <b>${esc(SUP_EMPRESA_LABEL[(pedido.empresa as "joke" | "juff")] ?? pedido.empresa)}</b></div>
  </div>
</header>
<div class="grid2">
  <div class="box">
    <div><b>Fornecedor:</b> ${esc(fornecedor?.razao_social ?? "—")}</div>
    <div><b>Nome fantasia:</b> ${esc(fornecedor?.nome_fantasia ?? "—")}</div>
    <div><b>Documento:</b> ${esc(fornecedor?.documento ?? "—")}</div>
    <div><b>Contato:</b> ${esc(fornecedor?.contato_nome ?? "—")} ${esc(fornecedor?.contato_telefone ?? "")}</div>
    <div><b>Cidade/UF:</b> ${esc(fornecedor?.cidade ?? "—")} ${esc(fornecedor?.uf ?? "")}</div>
  </div>
  <div class="box">
    <div><b>Data do pedido:</b> ${esc(fmtDataBR(pedido.data_pedido))}</div>
    <div><b>Previsão de entrega:</b> ${esc(fmtDataBR(pedido.previsao_entrega))}</div>
    <div><b>Condição de pagamento:</b> ${esc(condicao)}</div>
    
  </div>
</div>
<table class="itens">
  <thead><tr><th class="num">#</th><th>Produto</th><th class="num">Qtd</th><th class="num">Un.</th><th class="num">Preço</th><th class="num">Subtotal</th></tr></thead>
  <tbody>${linhas}</tbody>
  <tfoot>
    <tr><td colspan="5" style="text-align:right">Total dos itens</td><td class="num">${esc(fmtMoeda(subtotal))}</td></tr>
    <tr><td colspan="5" style="text-align:right">Frete</td><td class="num">${esc(fmtMoeda(pedido.frete_valor))}</td></tr>
    <tr><td colspan="5" style="text-align:right">Total geral</td><td class="num">${esc(fmtMoeda(subtotal + n(pedido.frete_valor)))}</td></tr>
  </tfoot>
</table>
<div class="obs"><b>Observações:</b>
${esc(pedido.observacoes ?? "")}</div>
<script>setTimeout(()=>{ try { window.print(); } catch(e){} }, 350);</script>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Não foi possível abrir o popup do pedido. Habilite popups para esta página.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = titulo;
}
