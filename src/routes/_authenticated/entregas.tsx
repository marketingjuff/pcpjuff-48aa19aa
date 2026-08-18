import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CheckCircle2, LogOut, QrCode, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import logoJuff from "@/assets/logo-juff.jpg.asset.json";
import type { Pedido } from "@/lib/pedidos";
import { formatDateBR } from "@/lib/format";
import { useMinhasPermissoes, useIsAdmin, useMyRoles } from "@/hooks/use-role";
import { rotaInicial } from "@/lib/permissoes";
import { enviarFotoCanhoto, fotosDoPedido, pedidosEntreguesRecentes, pedidosPendentesEntrega } from "@/lib/entregas";
import { CanhotoFotoViewer } from "@/components/pcp/CanhotoFotoViewer";

export const Route = createFileRoute("/_authenticated/entregas")({
  validateSearch: (s: Record<string, unknown>) => ({
    p: typeof s.p === "string" ? s.p : undefined,
  }) as { p?: string },
  head: () => ({
    meta: [
      { title: "Entregas do motorista | PCP Juff" },
      { name: "description", content: "Confirme entregas, leia o QR do canhoto e envie a foto do comprovante assinado." },
      { property: "og:title", content: "Entregas do motorista | PCP Juff" },
      { property: "og:description", content: "Confirme entregas e envie a foto do canhoto assinado direto do celular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EntregasPage,
});

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function EntregasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const isAdmin = useIsAdmin();
  const permissoes = useMinhasPermissoes();
  const { isLoading: rolesLoading } = useMyRoles();
  const pode = isAdmin || permissoes.has("entregas.motorista");
  const destino = rotaInicial(permissoes, isAdmin);

  useEffect(() => {
    if (rolesLoading || pode) return;
    navigate({ to: destino as any, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pode, rolesLoading, destino]);

  const { data: pedidos = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["entregas-pedidos"],
    enabled: pode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("exp_destino_humberto", true)
        .order("data_entrega", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Pedido[];
    },
  });

  const pendentes = useMemo(() => pedidosPendentesEntrega(pedidos), [pedidos]);
  const entregues = useMemo(() => pedidosEntreguesRecentes(pedidos), [pedidos]);

  const [scanAberto, setScanAberto] = useState(false);
  const focoId = search.p ?? null;
  const focado = focoId ? pedidos.find((p) => p.id === focoId) ?? null : null;

  const confirmar = useMutation({
    mutationFn: async ({ pedido, file }: { pedido: Pedido; file: File }) => {
      const fotos = await enviarFotoCanhoto(pedido, file);
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("pedidos")
        .update({
          canhoto_fotos: fotos as any,
          entrega_confirmada_em: new Date().toISOString(),
          entrega_confirmada_por: user.user?.id ?? null,
        })
        .eq("id", pedido.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entregas-pedidos"] });
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success("Entrega confirmada!");
      navigate({ to: "/entregas", search: {} as any, replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao confirmar a entrega."),
  });

  const [trocandoId, setTrocandoId] = useState<string | null>(null);

  const trocarFoto = useMutation({
    mutationFn: async ({ pedido, file }: { pedido: Pedido; file: File }) => {
      const fotos = await enviarFotoCanhoto(pedido, file);
      const { error } = await supabase
        .from("pedidos")
        .update({ canhoto_fotos: fotos as any })
        .eq("id", pedido.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entregas-pedidos"] });
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success("Foto do canhoto atualizada.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enviar a foto."),
    onSettled: () => setTrocandoId(null),
  });

  function dispararTroca(pedido: Pedido, file: File) {
    setTrocandoId(pedido.id);
    trocarFoto.mutate({ pedido, file });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth", replace: true });
  }

  if (rolesLoading || !pode) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-[720px] items-center gap-2 px-3 py-2.5">
          <img src={logoJuff.url} alt="Logo Juff" className="h-9 w-9 rounded-xl object-cover ring-1 ring-primary/15" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-semibold leading-tight truncate">Entregas</h1>
            <p className="text-[11px] text-muted-foreground truncate">Canhotos para confirmar</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} aria-label="Atualizar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-3 py-4 space-y-4">
        {focado && (
          <PedidoEntregaCard
            pedido={focado}
            destaque
            enviando={confirmar.isPending}
            onConfirmar={(file) => confirmar.mutate({ pedido: focado, file })}
            onFechar={() => navigate({ to: "/entregas", search: {} as any, replace: true })}
          />
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            Pendentes <span className="text-muted-foreground tabular-nums">({pendentes.length})</span>
          </h2>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : pendentes.length === 0 ? (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              Nenhuma entrega pendente.
            </div>
          ) : (
            pendentes
              .filter((p) => p.id !== focoId)
              .map((p) => (
                <PedidoEntregaCard
                  key={p.id}
                  pedido={p}
                  enviando={confirmar.isPending}
                  onConfirmar={(file) => confirmar.mutate({ pedido: p, file })}
                />
              ))
          )}
        </section>

        {entregues.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Entregues nos últimos 30 dias</h2>
            {entregues.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <div className="font-semibold tabular-nums">{p.pedido_olist ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.orcamento ?? "—"}</div>
                  </div>
                  <Badge variant="outline" className="bg-success/15 text-success border-success/30 whitespace-nowrap">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    {fmtDataHora(p.entrega_confirmada_em)}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-[720px]">
          <Button className="w-full h-12 text-base" onClick={() => setScanAberto(true)}>
            <QrCode className="h-5 w-5 mr-2" /> Ler QR do canhoto
          </Button>
        </div>
      </div>

      {scanAberto && (
        <ScannerQr
          onFechar={() => setScanAberto(false)}
          onLido={(id) => {
            setScanAberto(false);
            const existe = pedidos.some((p) => p.id === id);
            if (!existe) { toast.error("Pedido não encontrado na sua lista de entregas."); return; }
            navigate({ to: "/entregas", search: { p: id } as any, replace: true });
          }}
        />
      )}
    </div>
  );
}

function PedidoEntregaCard({
  pedido,
  destaque = false,
  enviando,
  onConfirmar,
  onFechar,
}: {
  pedido: Pedido;
  destaque?: boolean;
  enviando: boolean;
  onConfirmar: (file: File) => void;
  onFechar?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const confirmado = !!pedido.entrega_confirmada_em;

  return (
    <Card className={destaque ? "border-primary ring-1 ring-primary/30" : undefined}>
      <CardContent className="space-y-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-lg font-semibold tabular-nums">{pedido.pedido_olist ?? "—"}</div>
            <div className="text-sm truncate">{pedido.orcamento ?? "—"}</div>
            <div className="text-xs text-muted-foreground">
              Vendedor: {pedido.vendedor ?? "—"} · Limite: {formatDateBR(pedido.data_entrega) || "—"}
              {pedido.canhoto_horario_comercial ? " · Horário comercial" : ""}
            </div>
          </div>
          {onFechar && (
            <Button size="icon" variant="ghost" onClick={onFechar} aria-label="Fechar">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {confirmado ? (
          <Badge variant="outline" className="bg-success/15 text-success border-success/30">
            Entrega confirmada em {fmtDataHora(pedido.entrega_confirmada_em)}
          </Badge>
        ) : (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) onConfirmar(f);
              }}
            />
            <Button className="w-full h-11" disabled={enviando} onClick={() => fileRef.current?.click()}>
              <Camera className="h-4 w-4 mr-2" />
              {enviando ? "Enviando foto…" : "Tirar foto do canhoto e confirmar"}
            </Button>
            <p className="text-[11px] text-muted-foreground">A foto do canhoto assinado é obrigatória para confirmar.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ScannerQr({ onFechar, onLido }: { onFechar: () => void; onLido: (id: string) => void }) {
  const divId = "qr-reader-entregas";
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let scanner: any = null;
    let ativo = true;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        scanner = new Html5Qrcode(divId);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (texto: string) => {
            const id = extrairId(texto);
            if (!id) { setErro("QR inválido — leia o QR impresso no canhoto."); return; }
            if (!ativo) return;
            ativo = false;
            onLido(id);
          },
          () => {},
        );
      } catch (e: any) {
        setErro(e?.message ?? "Não foi possível abrir a câmera.");
      }
    })();
    return () => {
      ativo = false;
      if (scanner) scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Aponte para o QR do canhoto</div>
        <Button size="icon" variant="ghost" onClick={onFechar} aria-label="Fechar leitor">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div id={divId} className="w-full max-w-[420px] mx-auto rounded-md overflow-hidden border" />
      {erro && <div className="text-sm text-destructive text-center">{erro}</div>}
    </div>
  );
}

function extrairId(texto: string): string | null {
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(texto);
  return uuid ? uuid[0] : null;
}
