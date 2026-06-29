// Geração do PDF do Romaneio via janela de impressão.
// A4 vertical com dois A5 horizontais (vias idênticas) para impressão.
import logoJuff from "@/assets/logo-juff.jpg.asset.json";
import type { Cop, CopPeca, Oficina } from "@/lib/cop";
import { rotuloCop, totalPecasCop, numeroBaseCop, colunasTamanhos } from "@/lib/cop";

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtBR(d: string | null | undefined): string {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return d;
}

type Linha = { modelo: string; cor: string; qtds: Record<string, number>; total: number };

function agruparModeloCor(pecas: CopPeca[]): { linhas: Linha[]; colunas: string[] } {
  const map = new Map<string, Linha>();
  for (const p of pecas) {
    const k = `${p.modelo}|${p.cor}`;
    let l = map.get(k);
    if (!l) { l = { modelo: p.modelo, cor: p.cor, qtds: {}, total: 0 }; map.set(k, l); }
    l.qtds[p.tamanho] = (l.qtds[p.tamanho] || 0) + p.qtd;
    l.total += p.qtd;
  }
  const presentes = new Set<string>();
  for (const l of map.values()) for (const t of Object.keys(l.qtds)) presentes.add(t);
  const colunas = colunasTamanhos(presentes);
  const linhas = Array.from(map.values()).sort((a, b) =>
    a.modelo.localeCompare(b.modelo) || a.cor.localeCompare(b.cor),
  );
  return { linhas, colunas };
}

function viaHtml(cop: Cop, oficina: Oficina | null, rotuloStr: string): string {
  const { linhas, colunas } = agruparModeloCor(cop.pecas ?? []);
  const ths = colunas.map((t) => `<th class="num">${esc(t)}</th>`).join("");
  const corpo = linhas.length === 0
    ? `<tr><td colspan="${colunas.length + 3}" style="text-align:center;color:#888">Sem peças</td></tr>`
    : linhas.map((l) => `<tr>
        <td>${esc(l.modelo)}</td>
        <td>${esc(l.cor)}</td>
        ${colunas.map((t) => `<td class="num">${l.qtds[t] ? esc(l.qtds[t]) : ""}</td>`).join("")}
        <td class="num"><b>${esc(l.total)}</b></td>
      </tr>`).join("");
  return `
    <section class="via">
      <header>
        <img src="${esc(logoJuff.url)}" alt="Juff" />
        <div class="cab">
          <div class="t1">Romaneio Juff - COP ${esc(rotuloStr)}</div>
          <div class="t2">
            <span><b>Oficina:</b> ${esc(oficina?.nome ?? "—")}</span>
            <span><b>Saída:</b> ${esc(fmtBR(cop.data_saida_oficina))}</span>
            <span><b>Recebimento:</b> ${esc(fmtBR(cop.data_recebimento))}</span>
          </div>
        </div>
      </header>
      <table class="grid">
        <thead><tr><th>Modelo</th><th>Cor</th>${ths}<th class="num">Total</th></tr></thead>
        <tbody>${corpo}</tbody>
        <tfoot><tr><td colspan="${colunas.length + 2}" style="text-align:right"><b>Total geral</b></td><td class="num"><b>${totalPecasCop(cop.pecas)}</b></td></tr></tfoot>
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

export function abrirRomaneioParaImpressao(cop: Cop, oficina: Oficina | null, cops: Cop[] = []) {
  const numBase = cops.length ? numeroBaseCop(cop, cops) : cop.numero;
  const rotuloStr = rotuloCop(numBase, cop.letra);
  const titulo = `romaneio-${String(numBase).padStart(4, "0")}${cop.letra ?? ""}`;
  const html = `<!doctype html>
<html lang="pt-br"><head>
<meta charset="utf-8" />
<title>${esc(titulo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; color: #111; }
  @page { size: A4 portrait; margin: 8mm; }
  .page { width: 194mm; height: 281mm; display: flex; flex-direction: column; gap: 6mm; }
  .via { border: 1px dashed #999; padding: 5mm; height: 137mm; display: flex; flex-direction: column; gap: 2.5mm; }
  .via header { display: flex; align-items: center; gap: 6mm; border-bottom: 1px solid #ddd; padding-bottom: 2mm; }
  .via header img { width: 16mm; height: 16mm; object-fit: cover; border-radius: 2mm; }
  .via .t1 { font-size: 13pt; font-weight: 700; }
  .via .t2 { font-size: 8.5pt; color: #444; display: flex; flex-wrap: wrap; gap: 4mm; margin-top: 1mm; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  table.grid th, table.grid td { border: 1px solid #ccc; padding: 0.8mm 1.5mm; }
  table.grid th { background: #f3f4f6; text-align: left; font-weight: 600; }
  table.grid td.num, table.grid th.num { text-align: center; }
  .obs { font-size: 8.5pt; }
  .obs .lbl { color: #555; margin-bottom: 1mm; }
  .obs .box { min-height: 10mm; border: 1px solid #ccc; padding: 1.2mm; white-space: pre-wrap; }
  .ass { margin-top: auto; text-align: center; font-size: 8.5pt; color: #555; }
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
  ${viaHtml(cop, oficina, rotuloStr)}
  ${viaHtml(cop, oficina, rotuloStr)}
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
