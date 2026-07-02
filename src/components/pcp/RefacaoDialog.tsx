import { useEffect, useMemo, useState } from "react";
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
import { tipoIncluiDTF, type PecaPerdida } from "@/lib/pedidos";
import { PecasPerdidasEditor, pecaLinhaCompleta, somaPecas } from "./PecasPerdidasEditor";
import { useAppList, type AppListKind } from "@/lib/app-lists";

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
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinoLabel: string;
  destino: "dados" | "arte" | "dtf" | "silk" | "acabamento";
  tipoEstampa: string | null | undefined;
  onConfirm: (payload: RefacaoFormPayload) => void;
}

function kindForArea(area: string): AppListKind | null {
  switch (area) {
    case "Arte": return "refacao_problema_arte";
    case "DTF": return "refacao_problema_dtf";
    case "Silk": return "refacao_problema_silk";
    case "Acabamento": return "refacao_problema_acabamento";
    default: return "motivo_perda";
  }
}

export function RefacaoDialog({ open, onOpenChange, destinoLabel, tipoEstampa, onConfirm }: Props) {
  const mostraAdesivos = tipoIncluiDTF(tipoEstampa);
  const [pecasRefazer, setPecasRefazer] = useState<string>("");
  const [houvePerdaPecas, setHouvePerdaPecas] = useState<"sim" | "nao" | "">("");
  const [pecasPerdidas, setPecasPerdidas] = useState<PecaPerdida[]>([]);
  const [houvePerdaAdesivos, setHouvePerdaAdesivos] = useState<"sim" | "nao" | "">("");
  const [perdaAdesivos, setPerdaAdesivos] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [areaIdentificou, setAreaIdentificou] = useState<string>("");
  const [erroProd, setErroProd] = useState<"sim" | "nao" | "">("");
  const [areaErro, setAreaErro] = useState<string>("");
  const [problema, setProblema] = useState<string>("");
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    if (open) {
      setPecasRefazer("");
      setHouvePerdaPecas("");
      setPecasPerdidas([]);
      setHouvePerdaAdesivos("");
      setPerdaAdesivos("");
      setMotivo("");
      setAreaIdentificou("");
      setErroProd("");
      setAreaErro("");
      setProblema("");
      setErr("");
    }
  }, [open]);

  const kindProblema = kindForArea(areaErro);
  const { names: problemas } = useAppList((kindProblema ?? "motivo_perda") as AppListKind);
  const problemaOptions = useMemo(() => (kindProblema ? problemas : []), [kindProblema, problemas]);
  const { names: areasIdentifica } = useAppList("refacao_area_identifica");
  const { names: areasErro } = useAppList("refacao_area_erro");

  function confirmar() {
    // Novas perguntas obrigatórias (antes das existentes)
    if (!areaIdentificou) {
      setErr("Informe qual área identificou o problema.");
      return;
    }
    if (erroProd === "") {
      setErr("Informe se houve erro da produção.");
      return;
    }
    if (erroProd === "sim") {
      if (!areaErro) { setErr("Informe qual área errou."); return; }
      if (!problema) { setErr("Informe qual foi o problema."); return; }
    }

    const nPecas = Number(pecasRefazer);
    if (!Number.isFinite(nPecas) || nPecas < 1) {
      setErr("Informe quantas peças serão refeitas (mínimo 1).");
      return;
    }
    if (houvePerdaPecas === "") {
      setErr("Informe se houve perda de peças.");
      return;
    }
    let pecasPerdidasFinal: PecaPerdida[] = [];
    let nPerdaPecas = 0;
    if (houvePerdaPecas === "sim") {
      pecasPerdidasFinal = pecasPerdidas.filter(pecaLinhaCompleta);
      if (pecasPerdidasFinal.length === 0) {
        setErr("Adicione pelo menos uma peça perdida (modelo, cor, tamanho e qtd).");
        return;
      }
      nPerdaPecas = somaPecas(pecasPerdidasFinal);
      if (nPerdaPecas < 1) {
        setErr("A quantidade total de peças perdidas deve ser ≥ 1.");
        return;
      }
    }
    let nPerdaAdesivos = 0;
    if (mostraAdesivos) {
      if (houvePerdaAdesivos === "") {
        setErr("Informe se houve perda de adesivos.");
        return;
      }
      if (houvePerdaAdesivos === "sim") {
        nPerdaAdesivos = Number(perdaAdesivos);
        if (!Number.isFinite(nPerdaAdesivos) || nPerdaAdesivos < 1) {
          setErr("Informe quantos adesivos foram perdidos.");
          return;
        }
      }
    }
    onConfirm({
      pecas_refazer: nPecas,
      perda_pecas: nPerdaPecas,
      perda_adesivos: nPerdaAdesivos,
      motivo: motivo.trim(),
      pecas_perdidas: pecasPerdidasFinal,
      area_identificou: areaIdentificou,
      erro_producao: erroProd === "sim",
      area_erro: erroProd === "sim" ? areaErro : undefined,
      problema: erroProd === "sim" ? problema : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Refazer pedido</DialogTitle>
          <DialogDescription>
            Destino: <strong>{destinoLabel}</strong>. Registre os dados da refação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* --- Identificação do problema (obrigatório) --- */}
          <div className="rounded-md border bg-muted/20 p-3 space-y-3">
            <div className="text-[11px] text-muted-foreground font-medium uppercase">Identificação do problema</div>

            <div className="space-y-1">
              <Label>Qual área identificou o problema? *</Label>
              <Select value={areaIdentificou} onValueChange={setAreaIdentificou}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Houve erro da produção? *</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={erroProd === "sim" ? "default" : "outline"} onClick={() => setErroProd("sim")}>Sim</Button>
                <Button type="button" size="sm" variant={erroProd === "nao" ? "default" : "outline"} onClick={() => { setErroProd("nao"); setAreaErro(""); setProblema(""); }}>Não</Button>
              </div>
            </div>

            {erroProd === "sim" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Qual área errou? *</Label>
                  <Select value={areaErro} onValueChange={(v) => { setAreaErro(v); setProblema(""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Qual foi o problema? *</Label>
                  <Select value={problema} onValueChange={setProblema} disabled={!areaErro}>
                    <SelectTrigger><SelectValue placeholder={areaErro ? "Selecione..." : "Escolha a área primeiro"} /></SelectTrigger>
                    <SelectContent>
                      {problemaOptions.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">Sem opções cadastradas.</div>
                      ) : problemaOptions.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Quantas peças serão refeitas? *</Label>
            <Input
              type="number"
              min="1"
              value={pecasRefazer}
              onChange={(e) => setPecasRefazer(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <Label>Houve perda de peças? *</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={houvePerdaPecas === "sim" ? "default" : "outline"} onClick={() => setHouvePerdaPecas("sim")}>Sim</Button>
                <Button type="button" size="sm" variant={houvePerdaPecas === "nao" ? "default" : "outline"} onClick={() => { setHouvePerdaPecas("nao"); setPecasPerdidas([]); }}>Não</Button>
              </div>
            </div>
            {houvePerdaPecas === "sim" && (
              <div className="rounded-md border bg-background p-2 space-y-2">
                <div className="text-[11px] text-muted-foreground">
                  Liste cada peça perdida (modelo, cor, tamanho e quantidade). O total soma à quantidade original na produção.
                </div>
                <PecasPerdidasEditor value={pecasPerdidas} onChange={setPecasPerdidas} />
              </div>
            )}
          </div>

          {mostraAdesivos && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Houve perda de adesivos? *</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={houvePerdaAdesivos === "sim" ? "default" : "outline"} onClick={() => setHouvePerdaAdesivos("sim")}>Sim</Button>
                  <Button type="button" size="sm" variant={houvePerdaAdesivos === "nao" ? "default" : "outline"} onClick={() => { setHouvePerdaAdesivos("nao"); setPerdaAdesivos(""); }}>Não</Button>
                </div>
              </div>
              {houvePerdaAdesivos === "sim" && (
                <div className="space-y-1">
                  <Label>Quantos adesivos perdidos? *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={perdaAdesivos}
                    onChange={(e) => setPerdaAdesivos(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label>Observações da refação</Label>
            <Textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva observações complementares (opcional)"
            />
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
