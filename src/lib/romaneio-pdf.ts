// Geração do PDF do Romaneio via janela de impressão.
// A4 vertical com dois A5 horizontais (vias idênticas) para impressão.
import logoJuff from "@/assets/logo-juff.jpg.asset.json";
import type { Cop, Oficina } from "@/lib/cop";
import { rotuloCop, totalPecasCop } from "@/lib/cop";

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtBR(d: string | null | undefined): string {
  if (!d) return "—";
  // ISO YYYY-MM-DD → DD/MM/YYYY
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return d;
}

function viaHtml(cop: Cop, oficina: Oficina | null): string {
  const pecas = (cop.pecas ?? []).slice().sort((a, b) => {
    return (
      a.modelo.localeCompare(b.modelo) ||
      a.cor.localeCompare(b.cor) ||
      a.tamanho.localeCompare(b.tamanho)
    );
  });
  const linhas = pecas
    .map(
      (p) => `<tr>
        <td>${esc(p.modelo)}</td>
        <td>${esc(p.cor)}</td>
        <td style="text-align:center">${esc(p.tamanho)}</td>
        <td style="text-align:right">${esc(p.qtd)}</td>
      </tr>`,
    )
    .join("");
  return `
    <section class="via">
      <header>
        <img src="${esc(logoJuff.url)}" alt="Juff" />
        <div class="cab">
          <div class="t1">Romaneio · COP ${esc(rotuloCop(cop.numero, cop.letra))}</div>
          <div class="t2">
            <span><b>Oficina:</b> ${esc(oficina?.nome ?? "—")}</span>
            <span><b>Saída:</b> ${esc(fmtBR(cop.data_saida_oficina))}</span>
            <span><b>Recebimento:</b> ${esc(fmtBR(cop.data_recebimento))}</span>
          </div>
        </div>
      </header>
      <table class="grid">
        <thead><tr><th>Modelo</th><th>Cor</th><th>Tamanho</th><th>Qtd</th></tr></thead>
        <tbody>${linhas || `<tr><td colspan="4" style="text-align:center;color:#888">Sem peças</td></tr>`}</tbody>
        <tfoot><tr><td colspan="3" style="text-align:right"><b>Total</b></td><td style="text-align:right"><b>${totalPecasCop(cop.pecas)}</b></td></tr></tfoot>
      </table>
      <div class="obs">
        <div class="lbl">Observações:</div>
        <div class="box">${esc(cop.observacoes_romaneio ?? "")}</div>
      </div>
      <div class="ass">
        <div class="linha"></div>
        <div class="lbl">Responsável pela conferência</div>
      </div>
    </section>
  `;
}

export function abrirRomaneioParaImpressao(cop: Cop, oficina: Oficina | null) {
  const titulo = `romaneio-${String(cop.numero).padStart(4, "0")}${cop.letra ?? ""}`;
  const html = `<!doctype html>
<html lang="pt-br"><head>
<meta charset="utf-8" />
<title>${esc(titulo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; color: #111; }
  @page { size: A4 portrait; margin: 8mm; }
  .page { width: 194mm; height: 281mm; display: flex; flex-direction: column; gap: 6mm; }
  .via { border: 1px dashed #999; padding: 6mm; height: 137mm; display: flex; flex-direction: column; gap: 3mm; }
  .via header { display: flex; align-items: center; gap: 6mm; border-bottom: 1px solid #ddd; padding-bottom: 3mm; }
  .via header img { width: 18mm; height: 18mm; object-fit: cover; border-radius: 2mm; }
  .via .t1 { font-size: 14pt; font-weight: 700; }
  .via .t2 { font-size: 9pt; color: #444; display: flex; flex-wrap: wrap; gap: 4mm; margin-top: 1mm; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 9pt; }
  table.grid th, table.grid td { border: 1px solid #ccc; padding: 1.2mm 2mm; }
  table.grid th { background: #f3f4f6; text-align: left; }
  .obs { font-size: 9pt; }
  .obs .lbl { color: #555; margin-bottom: 1mm; }
  .obs .box { min-height: 12mm; border: 1px solid #ccc; padding: 1.5mm; white-space: pre-wrap; }
  .ass { margin-top: auto; text-align: center; font-size: 9pt; color: #555; }
  .ass .linha { border-top: 1px solid #333; margin: 0 auto; width: 70%; margin-bottom: 1mm; }
  @media print { .noprint { display: none !important; } }
</style>
</head><body>
<div class="noprint" style="padding:8px 12px;background:#f6f6f6;border-bottom:1px solid #ddd;display:flex;gap:8px;align-items:center;">
  <strong>${esc(titulo)}.pdf</strong>
  <button onclick="window.print()" style="padding:4px 10px">Imprimir / Salvar como PDF</button>
  <span style="color:#666;font-size:12px">Use "Salvar como PDF" no diálogo de impressão.</span>
</div>
<div class="page">
  ${viaHtml(cop, oficina)}
  ${viaHtml(cop, oficina)}
</div>
<script>setTimeout(()=>{ try { window.print(); } catch(e){} }, 350);</script>
</body></html>`;
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Não foi possível abrir o popup do romaneio. Habilite popups para esta página.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = titulo;
}
