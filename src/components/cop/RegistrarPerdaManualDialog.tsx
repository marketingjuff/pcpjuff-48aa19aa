import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { REFACAO_MODELOS, REFACAO_CORES, REFACAO_TAMANHOS } from "@/lib/pedidos";
import { areaExigeOficina, useAppList } from "@/lib/app-lists";
import { IdentificacaoErroCampos, IDENTIFICACAO_VAZIA, useBercosDoProblema, validarIdentificacaoErro, type IdentificacaoErro } from "./IdentificacaoErroCampos";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";



export function RegistrarPerdaManualDialog({
  open, onOpenChange, editId,
}: {
  open: boolean;
  editId?: string | null;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [data, setData] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [modelo, setModelo] = useState<string>(REFACAO_MODELOS[0]);
  const [cor, setCor] = useState<string>(REFACAO_CORES[0].nome);
  const [tamanho, setTamanho] = useState<string>(REFACAO_TAMANHOS[2]); // M
  const [qtd, setQtd] = useState<string>("1");
  const [ident, setIdent] = useState<IdentificacaoErro>(IDENTIFICACAO_VAZIA);
  const [err, setErr] = useState<string>("");
  const [oficinaId, setOficinaId] = useState<string>("");
  const [berco, setBerco] = useState<string>("");
  const [destino, setDestino] = useState<string>("");
  const [responsavel, setResponsavel] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");

  const { items: destinosItems } = useAppList("destino_perda" as any);
  const destinosList = destinosItems.map((i) => i.nome);

  const { lista: bercosLista, pede: pedeBerco } = useBercosDoProblema(ident.areaErro, ident.problema);

  useEffect(() => {
    if (!open || !editId) return;
    (async () => {
      const { data: r, error } = await (supabase as any).from("perdas_manuais").select("*").eq("id", editId).maybeSingle();
      if (error || !r) { toast.error("Não foi possível carregar a perda."); return; }
      setData(r.data); setModelo(r.modelo); setCor(r.cor); setTamanho(r.tamanho); setQtd(String(r.qtd));
      setIdent({
        areaIdentificou: r.area_identificou ?? "",
        dentroJuff: r.erro_producao === true ? "sim" : r.erro_producao === false ? "nao" : "",
        areaErro: r.area_erro ?? "",
        problema: r.problema ?? "",
      });
      setOficinaId(r.oficina_id ?? ""); setBerco(r.berco ?? ""); setDestino(r.destino ?? "");
      setResponsavel(r.responsavel ?? ""); setObservacoes(r.observacoes ?? "");
    })();
  }, [open, editId]);

  function reset() {
    setData(new Date().toISOString().slice(0, 10));
    setModelo(REFACAO_MODELOS[0]); setCor(REFACAO_CORES[0].nome); setTamanho(REFACAO_TAMANHOS[2]);
    setQtd("1"); setIdent(IDENTIFICACAO_VAZIA); setErr("");
    setOficinaId(""); setBerco(""); setDestino(""); setResponsavel(""); setObservacoes("");
  }

  function validar(): boolean {
    const e = validarIdentificacaoErro(ident, oficinaId, berco, bercosLista);
    if (e) { setErr(e); return false; }
    setErr("");
    return true;
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const q = Number(qtd);
      if (!Number.isFinite(q) || q <= 0) throw new Error("Quantidade inválida.");
      const { data: userData } = await supabase.auth.getUser();
      // Oficina/berço só gravam quando a regra pede; em edição antiga, mantém o que estava.
      const extras: Record<string, string | null> = {};
      if (areaExigeOficina(ident.areaErro)) extras.oficina_id = oficinaId || null;
      else if (!editId) extras.oficina_id = null;
      if (pedeBerco) extras.berco = berco || null;
      else if (!editId) extras.berco = null;
      const payload = {
        ...extras,
        data,
        modelo, cor, tamanho, qtd: q,
        area_identificou: ident.areaIdentificou,
        erro_producao: ident.dentroJuff === "sim",
        area_erro: ident.areaErro,
        problema: ident.problema,
        destino: destino || null,
        responsavel: responsavel.trim() || null,
        observacoes: observacoes.trim() || null,
        registrado_por: userData.user?.id ?? null,
      };
      if (editId) {
        const { registrado_por: _r, ...upd } = payload;
        const { error } = await (supabase as any).from("perdas_manuais").update(upd).eq("id", editId);
        if (error) throw error;
        return;
      }
      const { error } = await (supabase as any).from("perdas_manuais").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editId ? "Perda corrigida." : "Perda manual registrada.");
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
        <DialogHeader><DialogTitle>{editId ? "Corrigir perda manual" : "Registrar perda manual"}</DialogTitle></DialogHeader>
        <IdentificacaoErroCampos value={ident} onChange={setIdent} oficinaId={oficinaId} onOficinaChange={setOficinaId} berco={berco} onBercoChange={setBerco} />
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
        {err && <div className="text-sm text-destructive">{err}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvar.isPending}>Cancelar</Button>
          <Button onClick={() => { if (validar()) salvar.mutate(); }} disabled={salvar.isPending}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
