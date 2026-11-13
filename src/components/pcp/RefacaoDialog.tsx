import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { tipoIncluiDTF, type PecaPerdida, type RefacaoBloco } from "@/lib/pedidos";
import { Plus, Trash2 } from "lucide-react";
import { PecasPerdidasEditor, pecaLinhaCompleta, somaPecas } from "./PecasPerdidasEditor";
import { OficinaBercoCampos, erroBerco, useBercosDoProblema } from "@/components/cop/IdentificacaoErroCampos";
import { areaExigeOficina, useAppList, useKindProblemaPorArea, type AppListKind } from "@/lib/app-lists";

export type RefacaoFormPayload = {
  pecas_refazer: number;
  perda_pecas: number;
  perda_adesivos: number;
  motivo: string;
  pecas_perdidas: PecaPerdida[];
  area_identificou?: string;
  erro_producao?: boolean;
  area_erro?: string;
  problema?: string;
  oficina_id?: string;
  berco?: string;
  falta_adesivos?: boolean;
  qtd_falta_adesivos?: number;
  blocos: RefacaoBloco[];
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinoLabel: string;
  destino: "dados" | "arte" | "dtf" | "silk" | "acabamento";
  tipoEstampa: string | null | undefined;
  onConfirm: (payload: RefacaoFormPayload) => void;
}


type SimNao = "sim" | "nao" | "";

type BlocoEstado = {
  uid: number;
  erroProd: SimNao;
  areaErro: string;
  problema: string;
  oficinaId: string;
  berco: string;
  pecasRefazer: string;
  houvePerdaPecas: SimNao;
  pecasPerdidas: PecaPerdida[];
  houvePerdaAdesivos: SimNao;
  perdaAdesivos: string;
};

type BercoInfo = { pede: boolean; lista: string[] };

let uidSeq = 1;
function blocoVazio(): BlocoEstado {
  return {
    uid: uidSeq++, erroProd: "", areaErro: "", problema: "", oficinaId: "", berco: "",
    pecasRefazer: "", houvePerdaPecas: "", pecasPerdidas: [], houvePerdaAdesivos: "", perdaAdesivos: "",
  };
}

function BlocoMotivoCampos({
  indice, total, bloco, onChange, onRemover, mostraPerguntaAdesivo, onBercoInfo,
}: {
  indice: number;
  total: number;
  bloco: BlocoEstado;
  onChange: (patch: Partial<BlocoEstado>) => void;
  onRemover: () => void;
  mostraPerguntaAdesivo: boolean;
  onBercoInfo: (uid: number, info: BercoInfo) => void;
}) {
  const { erroProd, areaErro, problema, oficinaId, berco } = bloco;
  const kindProblema: AppListKind | null = useKindProblemaPorArea(areaErro);
  const { names: problemas } = useAppList((kindProblema ?? "motivo_perda") as AppListKind);
  const problemaOptions = useMemo(() => (kindProblema ? problemas : []), [kindProblema, problemas]);
  const { names: areasErroInt } = useAppList("refacao_area_erro");
  const { names: areasErroExt } = useAppList("refacao_area_erro_externa");
  const { lista: bercosLista, pede: pedeBerco } = useBercosDoProblema(areaErro, problema);
  const areasErro = erroProd === "nao" ? areasErroExt : areasErroInt;
  const chaveLista = bercosLista.join(",");
  useEffect(() => {
    onBercoInfo(bloco.uid, { pede: pedeBerco, lista: bercosLista });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloco.uid, pedeBerco, chaveLista]);

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground font-medium uppercase">Motivo {indice + 1}</div>
        {total > 1 && (
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onRemover} aria-label={`Remover motivo ${indice + 1}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <Label>O erro foi dentro da Juff? *</Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={erroProd === "sim" ? "default" : "outline"} onClick={() => onChange(erroProd !== "sim" ? { erroProd: "sim", areaErro: "", problema: "" } : { erroProd: "sim" })}>Sim</Button>
          <Button type="button" size="sm" variant={erroProd === "nao" ? "default" : "outline"} onClick={() => onChange({ erroProd: "nao", areaErro: "", problema: "" })}>Não</Button>
        </div>
      </div>

      {erroProd !== "" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>{erroProd === "sim" ? "Qual área errou? *" : "Quem errou de fora da Juff? *"}</Label>
            <Select value={areaErro} onValueChange={(v) => onChange({ areaErro: v, problema: "", berco: "", ...(areaExigeOficina(v) ? {} : { oficinaId: "" }) })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {areasErro.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Sem opções cadastradas.</div>
                ) : areasErro.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Qual foi o problema? *</Label>
            <Select value={problema} onValueChange={(v) => onChange({ problema: v, berco: "" })} disabled={!areaErro}>
              <SelectTrigger><SelectValue placeholder={areaErro ? "Selecione..." : "Escolha a área primeiro"} /></SelectTrigger>
              <SelectContent>
                {problemaOptions.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Sem opções cadastradas.</div>
                ) : problemaOptions.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <OficinaBercoCampos areaErro={areaErro} problema={problema}
            oficinaId={oficinaId} onOficinaChange={(v) => onChange({ oficinaId: v })}
            berco={berco} onBercoChange={(v) => onChange({ berco: v })} />
        </div>
      )}

      <div className="space-y-1">
        <Label>Quantas peças serão refeitas? *</Label>
        <Input type="number" min="1" value={bloco.pecasRefazer} onChange={(e) => onChange({ pecasRefazer: e.target.value })} />
      </div>

      <div className="space-y-2">
        <div className="space-y-1">
          <Label>Houve perda de peças? *</Label>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={bloco.houvePerdaPecas === "sim" ? "default" : "outline"} onClick={() => onChange({ houvePerdaPecas: "sim" })}>Sim</Button>
            <Button type="button" size="sm" variant={bloco.houvePerdaPecas === "nao" ? "default" : "outline"} onClick={() => onChange({ houvePerdaPecas: "nao", pecasPerdidas: [] })}>Não</Button>
          </div>
        </div>
        {bloco.houvePerdaPecas === "sim" && (
          <div className="rounded-md border bg-background p-2 space-y-2">
            <div className="text-[11px] text-muted-foreground">
              Liste cada peça perdida (modelo, cor, tamanho e quantidade). O total soma à quantidade original na produção.
            </div>
            <PecasPerdidasEditor value={bloco.pecasPerdidas} onChange={(v) => onChange({ pecasPerdidas: v })} />
          </div>
        )}
      </div>

      {mostraPerguntaAdesivo && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Houve perda de adesivos? *</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={bloco.houvePerdaAdesivos === "sim" ? "default" : "outline"} onClick={() => onChange({ houvePerdaAdesivos: "sim" })}>Sim</Button>
              <Button type="button" size="sm" variant={bloco.houvePerdaAdesivos === "nao" ? "default" : "outline"} onClick={() => onChange({ houvePerdaAdesivos: "nao", perdaAdesivos: "" })}>Não</Button>
            </div>
          </div>
          {bloco.houvePerdaAdesivos === "sim" && (
            <div className="space-y-1">
              <Label>Quantos adesivos perdidos? *</Label>
              <Input type="number" min="1" value={bloco.perdaAdesivos} onChange={(e) => onChange({ perdaAdesivos: e.target.value })} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Índice do primeiro bloco com perda de adesivo = Sim (ou -1). */
function primeiroComAdesivo(blocos: BlocoEstado[]): number {
  return blocos.findIndex((b) => b.houvePerdaAdesivos === "sim");
}

export function RefacaoDialog({ open, onOpenChange, destinoLabel, destino, tipoEstampa, onConfirm }: Props) {
  const mostraAdesivos = tipoIncluiDTF(tipoEstampa);
  const [blocos, setBlocos] = useState<BlocoEstado[]>(() => [blocoVazio()]);
  const [bercoInfo, setBercoInfo] = useState<Record<number, BercoInfo>>({});
  const [houveFaltaAdesivos, setHouveFaltaAdesivos] = useState<SimNao>("");
  const [faltaAdesivos, setFaltaAdesivos] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [areaIdentificou, setAreaIdentificou] = useState<string>("");
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    if (open) {
      setBlocos([blocoVazio()]);
      setBercoInfo({});
      setHouveFaltaAdesivos("");
      setFaltaAdesivos("");
      setMotivo("");
      setAreaIdentificou("");
      setErr("");
    }
  }, [open]);

  const { names: areasIdentifica } = useAppList("refacao_area_identifica");

  const onBercoInfo = useCallback((uid: number, info: BercoInfo) => {
    setBercoInfo((m) => ({ ...m, [uid]: info }));
  }, []);

  function atualizarBloco(idx: number, patch: Partial<BlocoEstado>) {
    setBlocos((bs) => {
      const novo = bs.map((b, i) => (i === idx ? { ...b, ...patch } : b));
      // Regra: a partir do primeiro bloco com perda de adesivo = Sim, os seguintes ficam zerados.
      const p = primeiroComAdesivo(novo);
      if (p >= 0) {
        return novo.map((b, i) => (i > p ? { ...b, houvePerdaAdesivos: "" as SimNao, perdaAdesivos: "" } : b));
      }
      return novo;
    });
  }

  function confirmar() {
    if (!areaIdentificou) {
      setErr("Informe qual área identificou o problema.");
      return;
    }
    const varios = blocos.length > 1;
    const pre = (i: number) => (varios ? `Motivo ${i + 1}. ` : "");
    const pAdesivo = primeiroComAdesivo(blocos);
    const finais: RefacaoBloco[] = [];
    for (let i = 0; i < blocos.length; i++) {
      const b = blocos[i];
      const falha = (m: string) => { setErr(pre(i) + m); return false; };
      if (b.erroProd === "") { falha("Informe se o erro foi dentro da Juff."); return; }
      if (b.erroProd === "sim") {
        if (!b.areaErro) { falha("Informe qual área errou."); return; }
        if (!b.problema) { falha("Informe qual foi o problema."); return; }
      }
      if (b.erroProd === "nao") {
        if (!b.areaErro) { falha("Informe quem errou de fora da Juff."); return; }
        if (!b.problema) { falha("Informe qual foi o problema."); return; }
      }
      if (areaExigeOficina(b.areaErro) && !b.oficinaId) { falha("Informe qual oficina."); return; }
      const info = bercoInfo[b.uid];
      const pedeBerco = !!info?.pede;
      if (pedeBerco) { const eB = erroBerco(b.berco, info.lista); if (eB) { falha(eB); return; } }

      const nPecas = Number(b.pecasRefazer);
      if (!Number.isFinite(nPecas) || nPecas < 1) { falha("Informe quantas peças serão refeitas (mínimo 1)."); return; }
      if (b.houvePerdaPecas === "") { falha("Informe se houve perda de peças."); return; }
      let pecasPerdidasFinal: PecaPerdida[] = [];
      let nPerdaPecas = 0;
      if (b.houvePerdaPecas === "sim") {
        pecasPerdidasFinal = b.pecasPerdidas.filter(pecaLinhaCompleta);
        if (pecasPerdidasFinal.length === 0) { falha("Adicione pelo menos uma peça perdida (modelo, cor, tamanho e qtd)."); return; }
        nPerdaPecas = somaPecas(pecasPerdidasFinal);
        if (nPerdaPecas < 1) { falha("A quantidade total de peças perdidas deve ser ≥ 1."); return; }
      }
      let nPerdaAdesivos = 0;
      const perguntaAdesivo = mostraAdesivos && (pAdesivo < 0 || i <= pAdesivo);
      if (perguntaAdesivo) {
        if (b.houvePerdaAdesivos === "") { falha("Informe se houve perda de adesivos."); return; }
        if (b.houvePerdaAdesivos === "sim") {
          nPerdaAdesivos = Number(b.perdaAdesivos);
          if (!Number.isFinite(nPerdaAdesivos) || nPerdaAdesivos < 1) { falha("Informe quantos adesivos foram perdidos."); return; }
        }
      }
      finais.push({
        erro_producao: b.erroProd === "sim",
        area_erro: b.areaErro,
        problema: b.problema,
        oficina_id: areaExigeOficina(b.areaErro) && b.oficinaId ? b.oficinaId : undefined,
        berco: pedeBerco && b.berco ? b.berco : undefined,
        pecas_refazer: nPecas,
        perda_pecas: nPerdaPecas,
        pecas_perdidas: pecasPerdidasFinal,
        perda_adesivos: nPerdaAdesivos,
      });
    }

    let nFaltaAdesivos = 0;
    if (mostraAdesivos) {
      if (houveFaltaAdesivos === "") { setErr("Informe se faltou adesivo."); return; }
      if (houveFaltaAdesivos === "sim") {
        nFaltaAdesivos = Number(faltaAdesivos);
        if (!Number.isFinite(nFaltaAdesivos) || nFaltaAdesivos < 1) { setErr("Informe quantos adesivos faltaram."); return; }
        if (destino !== "arte") {
          setErr("Faltou adesivo — refação deve ser feita para a Arte. Ajuste no seletor 'Refazer para...'.");
          return;
        }
      }
    }
    const b1 = finais[0];
    onConfirm({
      pecas_refazer: finais.reduce((s, b) => s + b.pecas_refazer, 0),
      perda_pecas: finais.reduce((s, b) => s + b.perda_pecas, 0),
      perda_adesivos: finais.reduce((s, b) => s + b.perda_adesivos, 0),
      motivo: motivo.trim(),
      pecas_perdidas: finais.flatMap((b) => b.pecas_perdidas),
      area_identificou: areaIdentificou,
      erro_producao: b1.erro_producao,
      area_erro: b1.area_erro || undefined,
      problema: b1.problema || undefined,
      oficina_id: b1.oficina_id,
      berco: b1.berco,
      falta_adesivos: mostraAdesivos ? houveFaltaAdesivos === "sim" : undefined,
      qtd_falta_adesivos: mostraAdesivos && houveFaltaAdesivos === "sim" ? nFaltaAdesivos : undefined,
      blocos: finais,
    });
  }

  const pAdesivo = primeiroComAdesivo(blocos);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Refazer pedido</DialogTitle>
          <DialogDescription>
            Destino: <strong>{destinoLabel}</strong>. Registre os dados da refação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/20 p-3 space-y-3">
            <div className="text-[11px] text-muted-foreground font-medium uppercase">Identificação do problema</div>
            <div className="space-y-1">
              <Label>Qual área identificou o problema? *</Label>
              <Select value={areaIdentificou} onValueChange={setAreaIdentificou}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {areasIdentifica.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Sem opções cadastradas.</div>
                  ) : areasIdentifica.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {blocos.map((b, i) => (
            <BlocoMotivoCampos
              key={b.uid}
              indice={i}
              total={blocos.length}
              bloco={b}
              onChange={(patch) => atualizarBloco(i, patch)}
              onRemover={() => setBlocos((bs) => (bs.length > 1 ? bs.filter((_, j) => j !== i) : bs))}
              mostraPerguntaAdesivo={mostraAdesivos && (pAdesivo < 0 || i <= pAdesivo)}
              onBercoInfo={onBercoInfo}
            />
          ))}

          <Button type="button" variant="outline" size="sm" onClick={() => setBlocos((bs) => [...bs, blocoVazio()])}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar outro motivo
          </Button>

          {mostraAdesivos && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Faltou adesivo? *</Label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={houveFaltaAdesivos === "sim" ? "default" : "outline"} onClick={() => setHouveFaltaAdesivos("sim")}>Sim</Button>
                    <Button type="button" size="sm" variant={houveFaltaAdesivos === "nao" ? "default" : "outline"} onClick={() => { setHouveFaltaAdesivos("nao"); setFaltaAdesivos(""); }}>Não</Button>
                  </div>
                </div>
                {houveFaltaAdesivos === "sim" && (
                  <div className="space-y-1">
                    <Label>Quantos adesivos faltaram? *</Label>
                    <Input type="number" min="1" value={faltaAdesivos} onChange={(e) => setFaltaAdesivos(e.target.value)} />
                  </div>
                )}
              </div>
              {houveFaltaAdesivos === "sim" && (
                <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded px-2 py-1.5">
                  Faltou adesivo obriga refazer a partir da <strong>Arte</strong>. Selecione "Refazer para Arte" antes de confirmar.
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label>Observações da refação</Label>
            <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva observações complementares (opcional)" />
          </div>

          {err && <div className="text-sm text-destructive">{err}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar}>Confirmar refação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
