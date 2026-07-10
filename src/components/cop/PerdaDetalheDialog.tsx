import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import type { PerdaConsolidada } from "@/lib/perdas-consolidado";
import { useProfilesMap, resolveNome } from "@/hooks/use-profiles-map";

function fmtDataBR(iso: string | null | undefined) {
  if (!iso) return "—";
  const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = onlyDate ? new Date(iso + "T00:00:00") : new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}

export function PerdaDetalheDialog({
  perda, open, onOpenChange,
}: {
  perda: PerdaConsolidada | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: profilesMap = {} } = useProfilesMap();
  if (!perda) return null;
  const hex = corHex(perda.cor);
  const fg = corTextoSobre(hex);

  const origemBadge =
    perda.origem === "pcp" ? <Badge className="bg-blue-600 hover:bg-blue-600">PCP</Badge>
    : perda.origem === "cop" ? <Badge className="bg-green-600 hover:bg-green-600">COP</Badge>
    : <Badge variant="secondary">Manual{perda.reclassificada ? " (reclassificada)" : ""}</Badge>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader><DialogTitle>Detalhe da perda</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">{origemBadge}
            {perda.identificacao && <span className="text-sm text-muted-foreground">· {perda.identificacao}</span>}
          </div>

          <div className="space-y-1.5">
            <Row label="Data" value={fmtDataBR(perda.data)} />
            <Row label="Modelo" value={perda.modelo} />
            <Row label="Cor" value={
              <span style={{ backgroundColor: hex, color: fg }} className="inline-block px-2 py-0.5 rounded text-xs">{perda.cor}</span>
            } />
            <Row label="Tamanho" value={perda.tamanho} />
            <Row label="Quantidade" value={<span className="tabular-nums">{perda.qtd}</span>} />
            <Row label="Motivo" value={perda.motivo} />
            {perda.area_erro != null || perda.erro_producao != null ? (
              <Row label="Área do erro" value={perda.erro_producao ? "Produção" : (perda.area_erro ?? "—")} />
            ) : null}
            {perda.area_identificou ? <Row label="Área que identificou" value={perda.area_identificou} /> : null}
            {perda.problema ? <Row label="Problema" value={perda.problema} /> : null}
            {perda.oficina_nome ? <Row label="Oficina" value={perda.oficina_nome} /> : null}
            {perda.berco ? <Row label="Berço" value={perda.berco} /> : null}
            {perda.destino ? <Row label="Destino" value={perda.destino} /> : null}
            {perda.responsavel ? <Row label="Responsável" value={perda.responsavel} /> : null}
            {perda.observacoes ? <Row label="Observações" value={<span className="whitespace-pre-wrap">{perda.observacoes}</span>} /> : null}
          </div>

          {perda.reclassificada && perda.reclass && (
            <div className="rounded-md border bg-amber-50 p-3 space-y-1.5">
              <div className="text-sm font-semibold text-amber-900">Histórico — Reclassificada</div>
              <Row label="Origem original" value={<>PCP · pedido {perda.identificacao ?? "—"}</>} />
              <Row label="Motivo original" value={perda.reclass.motivo_original} />
              <Row label="Área do erro original" value={perda.reclass.area_erro_original} />
              <Row label="Reclassificada em" value={fmtDataBR(perda.reclass.created_at)} />
              <Row label="Por" value={resolveNome(profilesMap, perda.reclass.usuario_id)} />
              <Row label="Observação (imutável)" value={<span className="whitespace-pre-wrap">{perda.reclass.observacao}</span>} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
