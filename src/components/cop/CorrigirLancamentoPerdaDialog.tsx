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

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cop: Cop | null;
  lancamento: LancamentoPerda | null;
  onConfirm: (payload: {
    refere_em: string;
    item_idx: number;
    antes: PerdaItemRef;
    depois: PerdaItemRef;
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

  const [destino, setDestino] = useState("");
  const [qtd, setQtd] = useState("");
  const [motivo, setMotivo] = useState<string>(SEM_MOTIVO);
  const [observacao, setObservacao] = useState("");

  const bloqueado = !!cop && (cop.pagamento_status === "pago" || cop.status === "Finalizado");

  const opcoes = useMemo(() => {
    const pecas = cop?.pecas ?? [];
    return pecas.map((p) => ({
      value: `${p.modelo}|${p.cor}|${p.tamanho}`,
      label: `${p.modelo} · ${p.cor} · ${p.tamanho} · ${p.qtd} pç`,
    }));
  }, [cop]);

  useEffect(() => {
    if (!open || !lancamento) return;
    setDestino(`${lancamento.modelo}|${lancamento.cor}|${lancamento.tamanho}`);
    setQtd(String(lancamento.qtd));
    setMotivo(lancamento.motivo ?? SEM_MOTIVO);
    setObservacao("");
  }, [open, lancamento]);

  const [dm, dc, dt] = destino ? destino.split("|") : ["", "", ""];
  const qtdNum = qtd === "" ? 0 : parseInt(qtd, 10) || 0;
  const linhaDestino = (cop?.pecas ?? []).find((p) => p.modelo === dm && p.cor === dc && p.tamanho === dt);

  const mesmaLinha = !!lancamento && lancamento.modelo === dm && lancamento.cor === dc && lancamento.tamanho === dt;
  const perdaAtualDestino = getPerda(cop?.perdas ?? [], dm, dc, dt);
  const perdaFinalDestino = perdaAtualDestino - (mesmaLinha ? (lancamento?.qtd ?? 0) : 0) + qtdNum;
  const tetoDestino = Number(linhaDestino?.qtd) || 0;
  const estouro = !!destino && perdaFinalDestino > tetoDestino;

  const podeSalvar =
    !bloqueado && !disabled && !!destino && qtdNum >= 1 && observacao.trim().length > 0 && !estouro;

  function salvar() {
    if (!lancamento || !podeSalvar) return;
    onConfirm({
      refere_em: lancamento.em,
      item_idx: lancamento.item_idx,
      antes: {
        modelo: lancamento.modelo, cor: lancamento.cor, tamanho: lancamento.tamanho,
        qtd: lancamento.qtd, motivo: lancamento.motivo ?? null,
      },
      depois: {
        modelo: dm, cor: dc, tamanho: dt, qtd: qtdNum,
        motivo: motivo === SEM_MOTIVO ? null : motivo,
      },
      observacao: observacao.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
          <div className="text-xs font-semibold uppercase text-muted-foreground">Como deve ficar</div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Linha de destino</label>
            <Combobox
              value={destino}
              onChange={setDestino}
              options={opcoes}
              placeholder="Selecione a linha"
              disabled={bloqueado || disabled}
            />
            {dc && <div className="pt-1"><CorChip cor={dc} /></div>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Quantidade</label>
            <Input
              inputMode="numeric"
              className="h-8 w-28 text-right tabular-nums [appearance:textfield]"
              value={qtd}
              onChange={(e) => setQtd(e.target.value.replace(/[^\d]/g, ""))}
              disabled={bloqueado || disabled}
            />
            <div className="text-[11px] text-muted-foreground">
              Para zerar um lançamento use Estornar, não a correção.
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Motivo</label>
            <Select value={motivo} onValueChange={setMotivo} disabled={bloqueado || disabled}>
              <SelectTrigger className="h-8 w-56"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_MOTIVO}>—</SelectItem>
                {motivos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Observação da correção *</label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Explique o que estava errado e o que foi corrigido."
              disabled={bloqueado || disabled}
            />
          </div>
        </div>

        {estouro && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            A correção deixaria {perdaFinalDestino} peças perdidas em {dm} {dc} {dt}, acima das {tetoDestino} cortadas nessa linha.
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
