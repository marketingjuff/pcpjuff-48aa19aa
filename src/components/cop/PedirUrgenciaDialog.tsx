import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Flame } from "lucide-react";
import type { CopPeca, CopPecaRecebida, CopPerdaLinha, CopUrgenciaLinha } from "@/lib/cop";
import { getRecebida, getPerda } from "@/lib/cop";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rotulo: string;
  pecas: CopPeca[];
  recebidas: CopPecaRecebida[];
  perdas: CopPerdaLinha[];
  onConfirm: (obs: string, linhas: CopUrgenciaLinha[]) => void;
  disabled?: boolean;
};

type TamInfo = { tamanho: string; total: number; recebida: number; perda: number; pendente: number };
type Grupo = { modelo: string; cor: string; tamanhos: TamInfo[]; pendenteTotal: number };

function agruparPorModeloCor(
  pecas: CopPeca[],
  recebidas: CopPecaRecebida[],
  perdas: CopPerdaLinha[],
  tamanhosOrdem: string[],
): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const p of pecas) {
    const k = `${p.modelo}|${p.cor}`;
    let g = map.get(k);
    if (!g) { g = { modelo: p.modelo, cor: p.cor, tamanhos: [], pendenteTotal: 0 }; map.set(k, g); }
    const total = Number(p.qtd) || 0;
    const rec = getRecebida(recebidas, p.modelo, p.cor, p.tamanho);
    const per = getPerda(perdas, p.modelo, p.cor, p.tamanho);
    const pend = Math.max(0, total - rec - per);
    g.tamanhos.push({ tamanho: p.tamanho, total, recebida: rec, perda: per, pendente: pend });
    g.pendenteTotal += pend;
  }
  for (const g of map.values()) {
    g.tamanhos.sort((a, b) => tamanhosOrdem.indexOf(a.tamanho) - tamanhosOrdem.indexOf(b.tamanho));
  }
  return Array.from(map.values()).sort((a, b) => a.modelo.localeCompare(b.modelo) || a.cor.localeCompare(b.cor));
}

export function PedirUrgenciaDialog({ open, onOpenChange, rotulo, pecas, recebidas, perdas, onConfirm, disabled }: Props) {
  const tamanhosOrdem = useMemo(() => {
    const set = new Set<string>();
    for (const p of pecas) set.add(p.tamanho);
    const preferida = ["PP", "P", "M", "G", "GG", "EXG", "EXXG", "EG"];
    return Array.from(set).sort((a, b) => {
      const ia = preferida.indexOf(a); const ib = preferida.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [pecas]);

  const grupos = useMemo(() => agruparPorModeloCor(pecas, recebidas, perdas, tamanhosOrdem), [pecas, recebidas, perdas, tamanhosOrdem]);

  // qtds[`${modelo}|${cor}|${tamanho}`] = number
  const [qtds, setQtds] = useState<Record<string, number>>({});
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!open) return;
    setQtds({});
    setObs("");
  }, [open]);

  function setQtd(k: string, v: number, max: number) {
    const n = Math.max(0, Math.min(max, Math.floor(Number.isFinite(v) ? v : 0)));
    setQtds((s) => ({ ...s, [k]: n }));
  }

  function marcarTodos(g: Grupo) {
    setQtds((s) => {
      const next = { ...s };
      for (const t of g.tamanhos) {
        if (t.pendente > 0) next[`${g.modelo}|${g.cor}|${t.tamanho}`] = t.pendente;
      }
      return next;
    });
  }

  function limparLinha(g: Grupo) {
    setQtds((s) => {
      const next = { ...s };
      for (const t of g.tamanhos) delete next[`${g.modelo}|${g.cor}|${t.tamanho}`];
      return next;
    });
  }

  const linhasSelecionadas: CopUrgenciaLinha[] = grupos
    .map((g) => {
      const tams = g.tamanhos
        .map((t) => ({ tamanho: t.tamanho, qtd: qtds[`${g.modelo}|${g.cor}|${t.tamanho}`] || 0 }))
        .filter((t) => t.qtd > 0);
      if (tams.length === 0) return null;
      return { modelo: g.modelo, cor: g.cor, tamanhos: tams } as CopUrgenciaLinha;
    })
    .filter((x): x is CopUrgenciaLinha => x !== null);

  const podeConfirmar = obs.trim().length > 0 && linhasSelecionadas.length > 0 && !disabled;

  function confirmar() {
    if (!podeConfirmar) return;
    onConfirm(obs.trim().toUpperCase(), linhasSelecionadas);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-red-600" />
            Pedir Urgência — Romaneio {rotulo}
          </DialogTitle>
          <DialogDescription>
            Informe as quantidades por tamanho que você cobrou como urgentes (parciais permitidos) e registre a observação
            da cobrança (ex.: "falei com a Mirta, prometeu dia 15"). O registro é imutável e fica no histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border overflow-x-auto max-h-[55vh]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs sticky top-0">
              <tr>
                <th className="p-2 text-left">Modelo</th>
                <th className="p-2 text-left">Cor</th>
                {tamanhosOrdem.map((t) => (
                  <th key={t} className="p-2 text-center w-20">{t}</th>
                ))}
                <th className="p-2 text-right w-20">Pend.</th>
                <th className="p-2 text-center w-28"></th>
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 ? (
                <tr><td colSpan={3 + tamanhosOrdem.length + 1} className="p-3 text-center text-muted-foreground">Sem peças.</td></tr>
              ) : grupos.map((g) => {
                const hex = corHex(g.cor); const fg = corTextoSobre(hex);
                const linhaCompleta = g.pendenteTotal === 0;
                return (
                  <tr key={`${g.modelo}|${g.cor}`} className={`border-t ${linhaCompleta ? "opacity-60" : ""}`}>
                    <td className="p-2 font-medium">{g.modelo}</td>
                    <td className="p-2">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: hex, color: fg }}>{g.cor}</span>
                    </td>
                    {tamanhosOrdem.map((tam) => {
                      const info = g.tamanhos.find((x) => x.tamanho === tam);
                      if (!info || info.total === 0) {
                        return <td key={tam} className="p-2 text-center text-muted-foreground">—</td>;
                      }
                      if (info.pendente === 0) {
                        return <td key={tam} className="p-1 text-center text-xs text-muted-foreground">✓</td>;
                      }
                      const k = `${g.modelo}|${g.cor}|${tam}`;
                      const val = qtds[k] ?? 0;
                      return (
                        <td key={tam} className="p-1 text-center">
                          <Input
                            type="number"
                            min={0}
                            max={info.pendente}
                            value={val === 0 ? "" : val}
                            placeholder={`0/${info.pendente}`}
                            onChange={(e) => setQtd(k, Number(e.target.value), info.pendente)}
                            disabled={disabled}
                            className="h-8 w-16 mx-auto text-center tabular-nums"
                          />
                        </td>
                      );
                    })}
                    <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">{g.pendenteTotal}</td>
                    <td className="p-1 text-center whitespace-nowrap">
                      {!linhaCompleta && (
                        <div className="flex items-center justify-center gap-1">
                          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => marcarTodos(g)} disabled={disabled}>Todos</Button>
                          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => limparLinha(g)} disabled={disabled}>Limpar</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Observação (obrigatória)</label>
          <Textarea
            rows={3}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="EX.: FALEI COM A MIRTA, PROMETEU DIA 15"
            className="uppercase"
            disabled={disabled}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>Cancelar</Button>
          <Button
            onClick={confirmar}
            disabled={!podeConfirmar}
            style={{ backgroundColor: "#dc2626", color: "#ffffff", borderColor: "#dc2626" }}
          >
            <Flame className="h-4 w-4 mr-1" />
            Registrar urgência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
