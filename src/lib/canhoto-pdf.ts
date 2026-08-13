// Canhotos de comprovante de recebimento — 5 por folha A4, via janela de impressão.
// Mesmo padrão dos outros PDFs do sistema (HTML + @page + window.print()).
import QRCode from "qrcode";
import logoJuff from "@/assets/loguinhojuffpreto.png.asset.json";
import type { Pedido } from "@/lib/pedidos";
import { formatDateBR } from "@/lib/format";

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const BASE_QR = "https://pcpjuff.lovable.app/entregas";

export async function abrirPdfCanhotos(pedidos: Pedido[]): Promise<void> {
  if (pedidos.length === 0) return;

  const qrs = await Promise.all(
    pedidos.map((p) =>
      QRCode.toDataURL(`${BASE_QR}?p=${p.id}`, { errorCorrectionLevel: "M", margin: 1, width: 260 }),
    ),
  );

  const tiras = pedidos
    .map((p, i) => {
      const quebra = (i + 1) % 5 === 0 && i + 1 < pedidos.length ? " quebra" : "";
      const marcado = (p as any).canhoto_horario_comercial === true;
      return `<div class="tira${quebra}">
  <div class="corpo">
    <div class="l1">
      <img class="logo" src="${esc(logoJuff.url)}" alt="Juff" />
      <div class="titulo">COMPROVANTE DE RECEBIMENTO</div>
      <div class="ident">
        <div>Vendedor: <b>${esc(p.vendedor ?? "—")}</b></div>
        <div class="ped">PEDIDO: ${esc(p.pedido_olist ?? "—")}</div>
      </div>
    </div>
    <div class="linha">
      <div class="campo w40"><span class="rot">CLIENTE:</span> <b>${esc(p.orcamento ?? "—")}</b></div>
      <div class="campo grow"><span class="rot">COMPLEMENTO DA ENTREGA:</span><span class="branco"></span></div>
    </div>
    <div class="linha">
      <div class="campo"><span class="rot">DATA LIMITE PARA ENTREGA:</span> <b>${esc(formatDateBR(p.data_entrega) || "—")}</b></div>
      <div class="campo"><span class="rot">HORÁRIO COMERCIAL</span><span class="quad">${marcado ? "X" : ""}</span></div>
      <div class="campo grow"><span class="rot">DATA:</span><span class="branco w14"></span><span class="rot">ÀS</span><span class="branco w10"></span><span class="rot">HRS</span></div>
    </div>
    <div class="linha">
      <div class="campo grow"><span class="rot">ASSINATURA RES.:</span><span class="branco"></span></div>
      <div class="campo grow"><span class="rot">RESTRIÇÕES:</span><span class="branco"></span></div>
    </div>
    <div class="linha">
      <div class="campo grow"><span class="rot">DOCUMENTO (RG OU CPF):</span><span class="branco"></span></div>
    </div>
  </div>
  <div class="qrbox">
    <img class="qr" src="${esc(qrs[i])}" alt="QR ${esc(p.pedido_olist ?? "")}" />
    <div class="qrnum">${esc(p.pedido_olist ?? "")}</div>
  </div>
</div>`;
    })
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Canhotos</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; color: #000; margin: 0; font-size: 8.5pt; }
  .tira { height: 54mm; width: 100%; border: 1.5pt solid #000; padding: 2mm 2.5mm; margin-bottom: 2mm;
          display: flex; gap: 2.5mm; page-break-inside: avoid; overflow: hidden; }
  .tira.quebra { page-break-after: always; }
  .corpo { flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
  .l1 { display: flex; align-items: center; gap: 2.5mm; }
  .logo { height: 7mm; width: auto; object-fit: contain; }
  .titulo { font-weight: 800; font-size: 10pt; }
  .ident { margin-left: auto; text-align: right; }
  .ident .ped { font-weight: 800; font-size: 12pt; }
  .linha { display: flex; gap: 3mm; align-items: flex-end; }
  .campo { display: flex; align-items: flex-end; gap: 1.5mm; white-space: nowrap; }
  .campo.grow { flex: 1; min-width: 0; }
  .campo.w40 { width: 40%; }
  .rot { font-weight: 700; }
  .branco { flex: 1; min-width: 12mm; border-bottom: 0.5pt solid #000; height: 3.6mm; }
  .branco.w14 { flex: none; width: 14mm; }
  .branco.w10 { flex: none; width: 10mm; }
  .quad { display: inline-block; width: 4mm; height: 4mm; border: 0.8pt solid #000;
          text-align: center; line-height: 4mm; font-weight: 800; }
  .qrbox { width: 22mm; text-align: center; }
  .qr { width: 22mm; height: 22mm; display: block; }
  .qrnum { font-size: 7pt; margin-top: 0.5mm; }
  @media print { .noprint { display: none !important; } }
</style>
</head><body>
<div class="noprint" style="padding:8px 12px;border-bottom:1px solid #000;display:flex;gap:8px;align-items:center;">
  <strong>Canhotos (${pedidos.length})</strong>
  <button onclick="window.print()" style="padding:4px 10px">Imprimir / Salvar como PDF</button>
</div>
${tiras}
<script>setTimeout(()=>{ try { window.print(); } catch(e){} }, 350);</script>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Não foi possível abrir o popup dos canhotos. Habilite popups para esta página.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = "Canhotos";
}
