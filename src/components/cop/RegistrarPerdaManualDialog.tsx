import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { REFACAO_MODELOS, REFACAO_CORES, REFACAO_TAMANHOS } from "@/lib/pedidos";
import { useAppList } from "@/lib/app-lists";
import { MOTIVOS_PERDA_PADRAO, type Oficina } from "@/lib/cop";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";

export function RegistrarPerdaManualDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [data, setData] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [modelo, setModelo] = useState<string>(REFACAO_MODELOS[0]);
  const [cor, setCor] = useState<string>(REFACAO_CORES[0].nome);
  const [tamanho, setTamanho] = useState<string>(REFACAO_TAMANHOS[2]); // M
  const [qtd, setQtd] = useState<string>("1");
  const [motivo, setMotivo] = useState<string>("");
  const [oficinaId, setOficinaId] = useState<string>("");
  const [berco, setBerco] = useState<string>("");
  const [destino, setDestino] = useState<string>("");
  const [responsavel, setResponsavel] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");

  const { items: motivosItems } = useAppList("motivo_perda");
  const motivosList = motivosItems.length > 0 ? motivosItems.map((i) => i.nome) : MOTIVOS_PERDA_PADRAO;
  const { items: destinosItems } = useAppList("destino_perda" as any);
  const destinosList = destinosItems.map((i) => i.nome);

  const { data: oficinas = [] } = useQuery({
    queryKey: ["oficinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas" as any).select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Pick<Oficina, "id" | "nome">[];
    },
  });

  function reset() {
    setData(new Date().toISOString().slice(0, 10));
    setModelo(REFACAO_MODELOS[0]); setCor(REFACAO_CORES[0].nome); setTamanho(REFACAO_TAMANHOS[2]);
    setQtd("1"); setMotivo(""); setOficinaId(""); setBerco(""); setDestino(""); setResponsavel(""); setObservacoes("");
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const q = Number(qtd);
      if (!Number.isFinite(q) || q <= 0) throw new Error("Quantidade inválida.");
      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        data,
        modelo, cor, tamanho, qtd: q,
        motivo: motivo.trim() || null,
        oficina_id: oficinaId || null,
        berco: berco.trim() || null,
        destino: destino || null,
        responsavel: responsavel.trim() || null,
        observacoes: observacoes.trim() || null,
        registrado_por: userData.user?.id ?? null,
      };
      const { error } = await (supabase as any).from("perdas_manuais").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perda manual registrada.");
      qc.invalidateQueries({ queryKey: ["perdas-cons-manuais"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao registrar."),
  });

  const hex = corHex(cor); const fg = corTextoSobre(hex);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader><DialogTitle>Registrar perda manual</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div><Label>Quantidade</Label><Input type="number" min="1" value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
          <div>
            <Label>Modelo</Label>
            <Select value={modelo} onValueChange={setModelo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REFACAO_MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cor</Label>
            <Select value={cor} onValueChange={setCor}>
              <SelectTrigger>
                <span className="inline-flex items-center gap-2">
                  <span style={{ backgroundColor: hex, color: fg }} className="inline-block px-1.5 py-0.5 rounded text-xs">{cor}</span>
                </span>
              </SelectTrigger>
              <SelectContent>
                {REFACAO_CORES.map((c) => {
                  const h = c.hex; const f = corTextoSobre(h);
                  return <SelectItem key={c.nome} value={c.nome}>
                    <span style={{ backgroundColor: h, color: f }} className="inline-block px-1.5 py-0.5 rounded text-xs">{c.nome}</span>
                  </SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tamanho</Label>
            <Select value={tamanho} onValueChange={setTamanho}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REFACAO_TAMANHOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motivo</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>{motivosList.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Oficina (opcional)</Label>
            <Select value={oficinaId || "__none__"} onValueChange={(v) => setOficinaId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {oficinas.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Berço (opcional)</Label><Input value={berco} onChange={(e) => setBerco(e.target.value)} placeholder="Ex.: Berço 3" /></div>
          <div>
            <Label>Destino (opcional)</Label>
            <Select value={destino || "__none__"} onValueChange={(v) => setDestino(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {destinosList.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Responsável (opcional)</Label><Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} /></div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvar.isPending}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
