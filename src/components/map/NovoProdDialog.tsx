import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInputBR } from "@/components/ui/date-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppList } from "@/lib/app-lists";
import type { MapProducao } from "@/lib/map";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  producoes: MapProducao[];
}

export function NovoProdDialog({ open, onOpenChange, onCreated, producoes }: Props) {
  const maxNumero = useMemo(
    () => producoes.reduce((m, p) => Math.max(m, Number(p.numero) || 0), 0),
    [producoes],
  );
  const numerosExistentes = useMemo(
    () => new Set(producoes.map((p) => Number(p.numero))),
    [producoes],
  );
  const hoje = new Date().toISOString().slice(0, 10);
  const [numero, setNumero] = useState<string>(String(maxNumero + 1));
  const [dataPedido, setDataPedido] = useState<string>(hoje);
  const [faturarPara, setFaturarPara] = useState<"Joke" | "Juff">("Juff");
  const [fornecedor, setFornecedor] = useState<string>("");
  const [kg, setKg] = useState<string>("");
  const [malharia, setMalharia] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { names: fornecedores } = useAppList("map_fio_fornecedor");
  const { names: malharias } = useAppList("map_malharia");

  async function handleSave() {
    const n = Number(numero);
    if (!Number.isFinite(n) || n <= 0) { toast.error("Número inválido."); return; }
    if (!dataPedido) { toast.error("Informe a data do pedido."); return; }
    if (!fornecedor.trim()) { toast.error("Informe o fornecedor."); return; }
    const kgN = Number(kg);
    if (!Number.isFinite(kgN) || kgN <= 0) { toast.error("Informe kg solicitados."); return; }

    if (numerosExistentes.has(n)) {
      const ok = window.confirm(`Já existe Prod ${n} — deseja continuar?`);
      if (!ok) return;
    }

    setSaving(true);
    const { error } = await (supabase as any).from("map_producoes").insert({
      numero: n,
      data_pedido: dataPedido,
      faturar_para: faturarPara,
      fornecedor: fornecedor.trim(),
      kg_solicitados: kgN,
      malharia: malharia.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Prod criado.");
    onCreated();
    onOpenChange(false);
    // reset
    setKg(""); setFornecedor(""); setMalharia("");
    setNumero(String(n + 1));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader><DialogTitle>Novo pedido de fio (Prod)</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Número do Prod</Label>
            <Input type="number" value={numero} onChange={(e) => setNumero(e.target.value)} />
          </div>
          <div>
            <Label>Data do pedido</Label>
            <DateInputBR value={dataPedido} onChange={(v) => setDataPedido(v ?? "")} />
          </div>
          <div>
            <Label>Faturar para</Label>
            <Select value={faturarPara} onValueChange={(v) => setFaturarPara(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Juff">Juff</SelectItem>
                <SelectItem value="Joke">Joke</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Kg solicitados</Label>
            <Input type="number" step="0.01" min="0" value={kg} onChange={(e) => setKg(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Fornecedor</Label>
            {fornecedores.length > 0 ? (
              <Select value={fornecedor} onValueChange={setFornecedor}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Nenhum cadastrado — digite aqui" />
            )}
          </div>
          <div className="col-span-2">
            <Label>Malharia (opcional)</Label>
            {malharias.length > 0 ? (
              <Select value={malharia || "__none__"} onValueChange={(v) => setMalharia(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {malharias.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={malharia} onChange={(e) => setMalharia(e.target.value)} />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>Criar Prod</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
