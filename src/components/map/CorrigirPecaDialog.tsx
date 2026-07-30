import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { REFACAO_CORES } from "@/lib/pedidos";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import {
  corComAcabamento,
  patchEstoquePeca,
  retingirProgramacao,
  useCorAcabamentos,
  type HistoricoCorrecaoEvento,
  type MapEstoquePeca,
} from "@/lib/map";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  peca: MapEstoquePeca;
  onDone: () => void;
}

export function CorrigirPecaDialog({ open, onOpenChange, peca, onDone }: Props) {
  const { mapa } = useCorAcabamentos();
  const [tipo, setTipo] = useState<"retingir" | "retrabalhar">("retingir");
  const [cor, setCor] = useState<string>(peca.cor ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setTipo("retingir"); setCor(peca.cor ?? ""); }
  }, [open, peca.cor]);

  const opcoes = useMemo(() => {
    const base = REFACAO_CORES.map((c) => ({ ...c, label: corComAcabamento(c.nome, mapa) }));
    if (peca.cor && !base.some((o) => o.label === peca.cor)) {
      base.unshift({ nome: peca.cor, hex: corHex(peca.cor.split("-")[0]), label: peca.cor } as any);
    }
    return base;
  }, [mapa, peca.cor]);

  async function confirmar() {
    if (tipo === "retingir" && !cor) { toast.error("Selecione a cor."); return; }
    setSaving(true);
    try {
      const corNova = tipo === "retingir" ? cor : (peca.cor ?? null);

      // Retingir move 1 peça (e kg proporcionais) da linha de tinturaria
      // original para uma linha da cor nova no bloco Tinturaria do PROD.
      let novaProgramacaoId: string | null = null;
      let retingir: Awaited<ReturnType<typeof retingirProgramacao>> | null = null;
      if (tipo === "retingir" && peca.programacao_id && corNova) {
        retingir = await retingirProgramacao(peca.programacao_id, corNova);
        novaProgramacaoId = retingir.destino_id;
      }

      const evento: HistoricoCorrecaoEvento = {
        tipo: "correcao_iniciada",
        em: new Date().toISOString(),
        correcao: tipo,
        ...(tipo === "retingir"
          ? {
              cor_nova: corNova,
              programacao_origem_id: peca.programacao_id ?? null,
              programacao_destino_id: retingir?.destino_id ?? null,
              destino_criada: retingir?.destino_criada,
              delta_kg_enviados: retingir?.delta_kg_enviados,
              origem_snapshot: retingir?.origem_snapshot ?? null,
            }
          : {}),
      };
      const historico = [...(Array.isArray(peca.historico_correcoes) ? peca.historico_correcoes : []), evento];
      await patchEstoquePeca(peca.id, {
        correcao_tipo: tipo,
        correcao_status: tipo === "retingir" ? "aguardando_retingir" : "em_retrabalho",
        cor_nova: corNova,
        historico_correcoes: historico,
        ...(novaProgramacaoId ? { programacao_id: novaProgramacaoId } : {}),
      } as any);
      toast.success(tipo === "retingir" ? "Peça enviada para retingir." : "Peça enviada para retrabalho.");
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar correção.");
    } finally {
      setSaving(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader><DialogTitle>Corrigir peça</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Tipo de correção</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="retingir">Retingir</SelectItem>
                <SelectItem value="retrabalhar">Retrabalhar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipo === "retingir" && (
            <div>
              <Label className="text-xs">Nova cor</Label>
              <Select value={cor} onValueChange={setCor}>
                <SelectTrigger
                  className="font-semibold"
                  style={cor ? { backgroundColor: corHex(cor.split("-")[0]), color: corTextoSobre(corHex(cor.split("-")[0])) } : undefined}
                >
                  <SelectValue placeholder="Selecione a cor" />
                </SelectTrigger>
                <SelectContent>
                  {opcoes.map((o: any) => {
                    const fg = corTextoSobre(o.hex);
                    return (
                      <SelectItem
                        key={o.label}
                        value={o.label}
                        style={{ backgroundColor: o.hex, color: fg }}
                        className="my-0.5 py-1 rounded-sm text-xs font-semibold focus:opacity-90"
                      >
                        {o.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <div className="text-[11px] text-muted-foreground mt-1">
                Retingir na mesma cor é permitido.
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={confirmar} disabled={saving}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
