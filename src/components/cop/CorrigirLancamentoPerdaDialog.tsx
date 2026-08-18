import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/shared/combobox";
import type { Cop, LancamentoPerda, PerdaItemRef } from "@/lib/cop";
import { MOTIVOS_PERDA_PADRAO, formatCopNumero, getPerda } from "@/lib/cop";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { useAppList } from "@/lib/app-lists";
import { AlertTriangle } from "lucide-react";

const SEM_MOTIVO = "__sem__";

type Linha = { destino: string; qtd: string; motivo: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cop: Cop | null;
  lancamento: LancamentoPerda | null;
  onConfirm: (payload: {
    refere_em: string;
    item_idx: number;
    antes: PerdaItemRef;
    depois: PerdaItemRef[];
    observacao: string;
  }) => void | Promise<void>;
  disabled?: boolean;
};

function CorChip({ cor }: { cor: string }) {
  const hex = corHex(cor);
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: hex, color: corTextoSobre(hex) }}>
      {cor}
    </span>
  );
}

function fmtDataHora(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function CorrigirLancamentoPerdaDialog({ open, onOpenChange, cop, lancamento, onConfirm, disabled }: Props) {
  const { names: motivosDb } = useAppList("motivo_perda");
  const motivos = motivosDb.length > 0 ? motivosDb : MOTIVOS_PERDA_PADRAO;

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [observacao, setObservacao] = useState("");

  const bloqueado = !!cop && (cop.pagamento_status === "pago" || cop.status === "Finalizado");
  const ro = bloqueado || !!disabled;

  const opcoes = useMemo(() => {
    const pecas = cop?.pecas ?? [];
    return pecas.map((p) => ({
      value: `${p.modelo}|${p.cor}|${p.tamanho}`,
      label: `${p.modelo} · ${p.cor} · ${p.tamanho} · ${p.qtd} pç`,
    }));
  }, [cop]);

  useEffect(() => {
    if (!open || !lancamento) return;
    setLinhas([{
      destino: `${lancamento.modelo}|${lancamento.cor}|${lancamento.tamanho}`,
      qtd: String(lancamento.qtd),
      motivo: lancamento.motivo ?? SEM_MOTIVO,
    }]);
    setObservacao("");
  }, [open, lancamento]);

  function setLinha(i: number, patch: Partial<Linha>) {
    setLinhas((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLinha() {
    setLinhas((arr) => [...arr, { destino: arr[0]?.destino ?? "", qtd: "", motivo: SEM_MOTIVO }]);
  }
  function removerLinha(i: number) {
    setLinhas((arr) => arr.filter((_, idx) => idx !== i));
  }

  const itens: PerdaItemRef[] = linhas.map((l) => {
    const [m, c, t] = l.destino ? l.destino.split("|") : ["", "", ""];
    return { modelo: m, cor: c, tamanho: t, qtd: l.qtd === "" ? 0 : parseInt(l.qtd, 10) || 0, motivo: l.motivo === SEM_MOTIVO ? null : l.motivo };
  });

  const total = itens.reduce((s, i) => s + i.qtd, 0);
  const todasValidas = itens.length > 0 && itens.every((i) => i.modelo && i.qtd >= 1);

  // teto por linha de destino
  const estouros = useMemo(() => {
    const out: string[] = [];
    const chaves = new Set(itens.filter((i) => i.modelo).map((i) => `${i.modelo}|${i.cor}|${i.tamanho}`));
    for (const k of chaves) {
      const [m, c, t] = k.split("|");
      const mesmaLinhaAntes = !!lancamento && lancamento.modelo === m && lancamento.cor === c && lancamento.tamanho === t;
      const atual = getPerda(cop?.perdas ?? [], m, c, t);
      const somaNova = itens.filter((i) => i.modelo === m && i.cor === c && i.tamanho === t).reduce((s, i) => s + i.qtd, 0);
      const final = atual - (mesmaLinhaAntes ? (lancamento?.qtd ?? 0) : 0) + somaNova;
      const teto = Number((cop?.pecas ?? []).find((p) => p.modelo === m && p.cor === c && p.tamanho === t)?.qtd) || 0;
      if (final > teto) out.push(`${m} ${c} ${t}: ${final} perdidas para ${teto} cortadas`);
    }
    return out;
  }, [itens, cop, lancamento]);

  const podeSalvar = !ro && todasValidas && observacao.trim().length > 0 && estouros.length === 0;

  function salvar() {
    if (!lancamento || !podeSalvar) return;
    onConfirm({
      refere_em: lancamento.em,
      item_idx: lancamento.item_idx,
      antes: {
        modelo: lancamento.modelo, cor: lancamento.cor, tamanho: lancamento.tamanho,
        qtd: lancamento.qtd, motivo: lancamento.motivo ?? null,
      },
      depois: itens,
      observacao: observacao.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Corrigir lançamento de perda</DialogTitle>
          <DialogDescription>
            COP {formatCopNumero(cop?.numero)}{cop?.letra ? cop.letra : ""} · lançamento de {fmtDataHora(lancamento?.em)}
          </DialogDescription>
        </DialogHeader>

        {bloqueado && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            COP pago ou finalizado não aceita correção de perda. Este diálogo está em modo somente leitura.
          </div>
        )}

        <div className="rounded-md border p-3 space-y-1">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Como está hoje</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold tabular-nums">{lancamento?.qtd ?? 0}</span>
            <span>{lancamento?.modelo ?? "—"}</span>
            {lancamento && <CorChip cor={lancamento.cor} />}
            <span>{lancamento?.tamanho ?? "—"}</span>
            <span className="text-muted-foreground">· {lancamento?.motivo || "sem motivo"}</span>
          </div>
        </div>

        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Como deve ficar</div>
            <div className="text-xs text-muted-foreground">
              Total: <b className="tabular-nums">{total}</b>
              {lancamento ? <> · original <span className="tabular-nums">{lancamento.qtd}</span></> : null}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_92px_220px_36px] gap-2 text-[11px] font-medium text-muted-foreground">
            <span>Linha de destino</span>
            <span className="text-right">Qtd</span>
            <span>Motivo</span>
            <span />
          </div>

          {linhas.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_92px_220px_36px] gap-2 items-center">
              <Combobox
                value={l.destino}
                onChange={(v) => setLinha(i, { destino: v })}
                options={opcoes}
                placeholder="Selecione a linha"
                disabled={ro}
              />
              <Input
                inputMode="numeric"
                className="h-8 text-right tabular-nums [appearance:textfield]"
                value={l.qtd}
                onChange={(e) => setLinha(i, { qtd: e.target.value.replace(/[^\d]/g, "") })}
                disabled={ro}
              />
              <Select value={l.motivo} onValueChange={(m) => setLinha(i, { motivo: m })} disabled={ro}>
                <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_MOTIVO}>—</SelectItem>
                  {motivos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              {linhas.length > 1 ? (
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Remover" onClick={() => removerLinha(i)} disabled={ro}>
                  <X className="h-4 w-4" />
                </Button>
              ) : <span />}
            </div>
          ))}

          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={addLinha} disabled={ro}>
              <Plus className="h-3.5 w-3.5 mr-1" />Outro motivo
            </Button>
            <span className="text-[11px] text-muted-foreground">Para zerar um lançamento use Estornar, não a correção.</span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Observação da correção *</label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Explique o que estava errado e o que foi corrigido."
              className="min-h-[64px]"
              disabled={ro}
            />
          </div>
        </div>

        {estouros.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive space-y-0.5">
            {estouros.map((e) => <div key={e}>{e}</div>)}
          </div>
        )}

        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-yellow-600" />
          <span>
            Corrigir a perda muda o saldo Disponível e o valor a pagar da oficina.
            O registro original fica guardado no histórico deste COP.
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!podeSalvar}>Salvar correção</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
