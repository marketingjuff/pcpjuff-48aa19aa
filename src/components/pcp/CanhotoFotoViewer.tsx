import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Image as ImageIcon } from "lucide-react";
import type { Pedido } from "@/lib/pedidos";
import { fotosDoPedido, ultimaFoto, urlAssinadaCanhoto } from "@/lib/entregas";

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CanhotoFotoViewer({
  pedido,
  label = "Ver canhoto",
  size = "sm",
}: {
  pedido: Pedido;
  label?: string;
  size?: "sm" | "default" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const fotos = fotosDoPedido(pedido);
  if (fotos.length === 0) return null;

  return (
    <>
      <Button type="button" size={size} variant="outline" onClick={() => setOpen(true)}>
        <ImageIcon className="h-4 w-4 mr-1" /> {label}
      </Button>
      {open && <CanhotoDialog pedido={pedido} onClose={() => setOpen(false)} />}
    </>
  );
}

function CanhotoDialog({ pedido, onClose }: { pedido: Pedido; onClose: () => void }) {
  const fotos = fotosDoPedido(pedido);
  const foto = ultimaFoto(pedido);
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!foto) return;
    urlAssinadaCanhoto(foto.path)
      .then((u) => { if (ativo) setUrl(u); })
      .catch((e: any) => { if (ativo) setErro(e?.message ?? "Falha ao carregar a foto."); });
    return () => { ativo = false; };
  }, [foto?.path]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[900px]">
        <DialogHeader>
          <DialogTitle>Canhoto — Pedido {pedido.pedido_olist ?? "—"}</DialogTitle>
        </DialogHeader>
        {erro ? (
          <div className="text-sm text-destructive">{erro}</div>
        ) : url ? (
          <div className="space-y-2">
            <img src={url} alt={`Canhoto do pedido ${pedido.pedido_olist ?? ""}`} className="w-full rounded-md border" />
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {fotos.length > 1
                  ? `${fotos.length} versões — exibindo a mais recente (${fmtDataHora(foto?.em)})`
                  : `Enviada em ${fmtDataHora(foto?.em)}`}
              </div>
              <Button size="sm" variant="outline" onClick={() => window.open(url, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-1" /> Abrir em nova aba
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Carregando foto…</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
