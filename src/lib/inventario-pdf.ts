// Geração do PDF do Inventário — A4 vertical, preto e branco, fluxo contínuo.
import logoJuff from "@/assets/loguinhojuffpreto.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

export interface InventarioRow {
  cor: string;
  numero_peca: string;
  status: string;
  data_entrada: string; // dd/mm/aaaa ou "—"
  larg: string;         // ex: "1,80" ou "—"
  altura: string;       // saldo formatado ou "—"
}

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function hojeBR(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export async function abrirInventarioParaImpressao(rows: InventarioRow[]) {
  const dataStr = hojeBR();
  const titulo = `inventario-${dataStr.replace(/\//g, "-")}`;

  const { data: { user } } = await supabase.auth.getUser();
  const gerador = user?.email ?? user?.user_metadata?.name ?? "usuário desconhecido";

  const body = rows.map((r) => `
    <tr>
      <td>${esc(r.cor)}</td>
      <td>${esc(r.numero_peca)}</td>
      <td>${esc(r.status)}</td>
      <td>${esc(r.data_entrada)}</td>
      <td class="hand"></td>
      <td>${esc(r.larg)}</td>
      <td>${esc(r.altura)}</td>
      <td class="hand"></td>
      <td class="hand"></td>
    </tr>
  `).join("");

  const html = `<!doctype html>
<html lang="pt-br"><head>
<meta charset="utf-8" />
<title>${esc(titulo)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; color: #000; background: #fff; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  @page { size: A4 portrait; margin: 8mm; @top-right { content: "Página " counter(page); font-family: ui-sans-serif, system-ui, sans-serif; font-size: 10pt; color: #000; } }
  .cab { display: flex; align-items: center; gap: 6mm; border-bottom: 1px solid #000; padding-bottom: 3mm; margin-bottom: 3mm; }
  .cab img { width: 20mm; height: 20mm; object-fit: contain; }
  .titleblock { flex: 1; display: flex; flex-direction: column; gap: 1mm; }
  .title { font-size: 26pt; font-weight: 700; letter-spacing: 0.5px; line-height: 1; }
  .data { font-size: 22pt; font-weight: 700; line-height: 1.1; }
  table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10pt; }
  table.grid th, table.grid td { border: 1px solid #000; padding: 2mm 1.5mm; text-align: center; overflow: hidden; }
  table.grid thead { display: table-header-group; }
  table.grid tr { page-break-inside: avoid; break-inside: avoid; }
  table.grid th { font-weight: 700; font-size: 8pt; background: #fff; padding: 1.5mm 0.5mm; white-space: nowrap; }
  table.grid td { height: 10mm; }
  table.grid td.hand { background: #fff; }
  table.grid tfoot td { border: none; padding: 1.5mm 0 0; font-size: 7pt; color: #333; text-align: left; }
  col.descanso { width: 20mm; }
  col.corte { width: 15mm; }
  col.obs { width: auto; }
  col.uni { width: 22mm; }
  @media print { .noprint { display: none !important; } }
</style>
</head><body>
<div class="noprint" style="padding:8px 12px;background:#fff;border-bottom:1px solid #000;display:flex;gap:8px;align-items:center;">
  <strong>${esc(titulo)}.pdf</strong>
  <button onclick="window.print()" style="padding:4px 10px">Imprimir / Salvar como PDF</button>
  <span style="color:#000;font-size:12px">Use "Salvar como PDF" no diálogo de impressão.</span>
</div>
<header class="cab">
  <img src="${esc(logoJuff.url)}" alt="Juff" />
  <div class="titleblock">
    <div class="title">Inventário</div>
    <div class="data">${esc(dataStr)}</div>
  </div>
</header>
<table class="grid">
  <colgroup>
    <col class="uni" /><col class="uni" /><col class="uni" /><col class="uni" />
    <col class="descanso" />
    <col class="uni" /><col class="uni" />
    <col class="corte" />
    <col class="obs" />
  </colgroup>
  <thead>
    <tr>
      <th>COR</th>
      <th>Nº DA PEÇA</th>
      <th>STATUS</th>
      <th>ENTRADA</th>
      <th>DESCANSO</th>
      <th>LARGURA</th>
      <th>ALTURA</th>
      <th>CORTE</th>
      <th>SOBRA/OBS</th>
    </tr>
  </thead>
  <tbody>${body}</tbody>
  <tfoot>
    <tr>
      <td colspan="9">Inventário gerado em ${esc(dataStr)} por ${esc(gerador)}</td>
    </tr>
  </tfoot>
</table>
<script>setTimeout(()=>{ try { window.print(); } catch(e){} }, 350);</script>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Não foi possível abrir o popup do inventário. Habilite popups para esta página.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = titulo;
}
