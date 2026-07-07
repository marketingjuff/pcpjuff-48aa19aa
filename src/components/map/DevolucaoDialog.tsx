import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MapProducao, MapProgramacaoTinturaria } from "@/lib/map";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  producao: MapProducao;
  programacoes: MapProgramacaoTinturaria[];
  onDone: () => void;
}

function notEmpty(v: unknown): boolean {
  return v != null && String(v).trim() !== "";
}

export function DevolucaoDialog({ open, onOpenChange, producao, programacoes, onDone }: Props) {
  const [nf, setNf] = useState<string>("");
  const [cor, setCor] = useState<string>("");
  const [data, setData] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [pecas, setPecas] = useState<string>("");
  const [kg, setKg] = useState<string>("");
  const [faturado, setFaturado] = useState<"Joke" | "Juff">(producao.faturar_para);
  const [obs, setObs] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [jaDevolvido, setJaDevolvido] = useState<{ pecas: number; kg: number }>({ pecas: 0, kg: 0 });

  // Notas fiscais distintas de recebimento
  const nfs = useMemo(() => {
    const s = new Set<string>();
    for (const p of programacoes) if (notEmpty(p.nota_fiscal_recebimento)) s.add(String(p.nota_fiscal_recebimento));
    return Array.from(s).sort();
  }, [programacoes]);

  const cores = useMemo(() => {
    if (!nf) return [] as string[];
    const s = new Set<string>();
    for (const p of programacoes) {
      if (p.nota_fiscal_recebimento === nf && notEmpty(p.cor)) s.add(String(p.cor));
    }
    return Array.from(s).sort();
  }, [programacoes, nf]);

  // Totais recebidos para NF+cor selecionadas
  const totais = useMemo(() => {
    if (!nf || !cor) return { pecas: 0, kg: 0 };
    let tp = 0, tk = 0;
    for (const p of programacoes) {
      if (p.nota_fiscal_recebimento === nf && p.cor === cor) {
        tp += Number(p.pecas_recebidas ?? 0);
        tk += Number(p.kg_recebidos ?? 0);
      }
    }
    return { pecas: tp, kg: tk };
  }, [programacoes, nf, cor]);

  // Ao mudar NF/cor, buscar quanto já foi devolvido para este PROD+NF+cor
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!open || !nf || !cor) { setJaDevolvido({ pecas: 0, kg: 0 }); return; }
      const { data, error } = await (supabase as any)
        .from("map_devolucoes")
        .select("pecas,kg")
        .eq("producao_id", producao.id)
        .eq("nota_fiscal", nf)
        .eq("cor", cor);
      if (cancel) return;
      if (error) { setJaDevolvido({ pecas: 0, kg: 0 }); return; }
      const tp = (data ?? []).reduce((s: number, r: any) => s + Number(r.pecas ?? 0), 0);
      const tk = (data ?? []).reduce((s: number, r: any) => s + Number(r.kg ?? 0), 0);
      setJaDevolvido({ pecas: tp, kg: tk });
    })();
    return () => { cancel = true; };
  }, [open, nf, cor, producao.id]);

  useEffect(() => {
    if (!open) {
      setNf(""); setCor(""); setPecas(""); setKg(""); setObs("");
      setData(new Date().toISOString().slice(0, 10));
      setFaturado(producao.faturar_para);
    }
  }, [open, producao.faturar_para]);

  const maxPecas = Math.max(0, totais.pecas - jaDevolvido.pecas);
  const maxKg = Math.max(0, totais.kg - jaDevolvido.kg);

  const nPecas = Number(pecas.replace(",", "."));
  const nKg = Number(kg.replace(",", "."));

  const errors: string[] = [];
  if (!nf) errors.push("Selecione a nota fiscal.");
  if (!cor) errors.push("Selecione a cor.");
  if (!notEmpty(data)) errors.push("Informe a data.");
  if (!(nPecas > 0)) errors.push("Peças deve ser > 0.");
  if (!(nKg > 0)) errors.push("Kg deve ser > 0.");
  if (nf && cor && nPecas > maxPecas) errors.push(`Peças excede o disponível (máx ${maxPecas}).`);
  if (nf && cor && nKg > maxKg) errors.push(`Kg excede o disponível (máx ${maxKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}).`);

  async function handleSave() {
    if (errors.length) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("map_devolucoes").insert({
      producao_id: producao.id,
      nota_fiscal: nf,
      cor,
      pecas: nPecas,
      kg: nKg,
      faturado_para: faturado,
      data_devolucao: data,
      obs: obs.trim() || null,
      status: "em_andamento",
      created_by: u.user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Devolução registrada.");
    onDone();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader><DialogTitle>Registrar devolução</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-1">
            <Label className="text-xs">Nota fiscal (recebimento)</Label>
            <Select value={nf} onValueChange={(v) => { setNf(v); setCor(""); }}>
              <SelectTrigger><SelectValue placeholder={nfs.length ? "Selecione" : "Sem NFs"} /></SelectTrigger>
              <SelectContent>
                {nfs.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <Label className="text-xs">Cor</Label>
            <Select value={cor} onValueChange={setCor} disabled={!nf}>
              <SelectTrigger><SelectValue placeholder={nf ? "Selecione" : "Selecione a NF"} /></SelectTrigger>
              <SelectContent>
                {cores.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-1">
            <Label className="text-xs">Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="col-span-1">
            <Label className="text-xs">Empresa faturada</Label>
            <Select value={faturado} onValueChange={(v) => setFaturado(v as any)}>
              <SelectTrigger className="uppercase"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Joke" className="uppercase">Joke</SelectItem>
                <SelectItem value="Juff" className="uppercase">Juff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-1">
            <Label className="text-xs">Peças</Label>
            <Input inputMode="decimal" value={pecas} onChange={(e) => setPecas(e.target.value)} />
            {nf && cor && (
              <div className="text-[11px] text-muted-foreground mt-1">Disponível: {maxPecas.toLocaleString("pt-BR")}</div>
            )}
          </div>
          <div className="col-span-1">
            <Label className="text-xs">Kg</Label>
            <Input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} />
            {nf && cor && (
              <div className="text-[11px] text-muted-foreground mt-1">Disponível: {maxKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</div>
            )}
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>

          {errors.length > 0 && (
            <div className="col-span-2 text-xs text-destructive space-y-0.5">
              {errors.map((e) => <div key={e}>• {e}</div>)}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || errors.length > 0}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
