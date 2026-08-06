import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus } from "lucide-react";
import type { SupVariacao, SupVariacaoValor } from "@/lib/sup";

const norm = (s: string) => s.trim().toLowerCase();

export function useSupVariacoes() {
  return useQuery({
    queryKey: ["sup-variacoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sup_variacoes")
        .select("*")
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as SupVariacao[];
    },
  });
}

export function useSupVariacaoValores() {
  return useQuery({
    queryKey: ["sup-variacao-valores"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sup_variacao_valores")
        .select("*")
        .order("ordem")
        .order("valor");
      if (error) throw error;
      return (data ?? []) as SupVariacaoValor[];
    },
  });
}

export function VariacoesConfig() {
  const qc = useQueryClient();
  const { data: variacoes = [] } = useSupVariacoes();
  const { data: valores = [] } = useSupVariacaoValores();

  const [selId, setSelId] = useState<string | null>(null);
  const sel = variacoes.find((v) => v.id === selId) ?? null;

  const [tipoOpen, setTipoOpen] = useState(false);
  const [tipoEdit, setTipoEdit] = useState<SupVariacao | null>(null);
  const [tipoNome, setTipoNome] = useState("");

  const [valorOpen, setValorOpen] = useState(false);
  const [valorEdit, setValorEdit] = useState<SupVariacaoValor | null>(null);
  const [valorTexto, setValorTexto] = useState("");

  const valoresDoTipo = useMemo(
    () => valores.filter((v) => v.variacao_id === selId),
    [valores, selId],
  );

  const salvarTipo = useMutation({
    mutationFn: async () => {
      const nome = tipoNome.trim();
      if (!nome) throw new Error("Informe o nome da variação.");
      if (variacoes.some((v) => v.id !== tipoEdit?.id && norm(v.nome) === norm(nome))) {
        throw new Error("__DUP__");
      }
      if (tipoEdit) {
        const { error } = await (supabase as any).from("sup_variacoes").update({ nome }).eq("id", tipoEdit.id);
        if (error) throw error;
        return tipoEdit.id;
      }
      const { data, error } = await (supabase as any)
        .from("sup_variacoes")
        .insert({ nome })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["sup-variacoes"] });
      if (!tipoEdit) setSelId(id);
      setTipoOpen(false);
      setTipoEdit(null);
      toast.success("Variação salva.");
    },
    onError: (e: any) =>
      toast.error(e.message === "__DUP__" ? "Já existe uma variação com esse nome." : (e.message ?? "Erro ao salvar variação.")),
  });

  const alternarTipo = useMutation({
    mutationFn: async (v: SupVariacao) => {
      const { error } = await (supabase as any).from("sup_variacoes").update({ ativo: !v.ativo }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sup-variacoes"] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao alterar situação."),
  });

  const salvarValor = useMutation({
    mutationFn: async () => {
      if (!selId) throw new Error("Selecione um tipo de variação.");
      const valor = valorTexto.trim();
      if (!valor) throw new Error("Informe o valor.");
      if (valores.some((v) => v.variacao_id === selId && v.id !== valorEdit?.id && norm(v.valor) === norm(valor))) {
        throw new Error("__DUP__");
      }
      if (valorEdit) {
        const { error } = await (supabase as any).from("sup_variacao_valores").update({ valor }).eq("id", valorEdit.id);
        if (error) throw error;
        return;
      }
      const { error } = await (supabase as any)
        .from("sup_variacao_valores")
        .insert({ variacao_id: selId, valor });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-variacao-valores"] });
      setValorOpen(false);
      setValorEdit(null);
      toast.success("Valor salvo.");
    },
    onError: (e: any) =>
      toast.error(e.message === "__DUP__" ? "Este tipo já tem esse valor." : (e.message ?? "Erro ao salvar valor.")),
  });

  const alternarValor = useMutation({
    mutationFn: async (v: SupVariacaoValor) => {
      const { error } = await (supabase as any).from("sup_variacao_valores").update({ ativo: !v.ativo }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sup-variacao-valores"] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao alterar situação."),
  });

  return (
    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-md border bg-card overflow-hidden">
        <div className="px-3 py-2 bg-muted/40 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Tipos de variação</span>
          <Button
            size="sm"
            className="h-7 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => { setTipoEdit(null); setTipoNome(""); setTipoOpen(true); }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
          </Button>
        </div>
        <div className="p-2 text-[11px] text-muted-foreground">
          Ex.: Cor, Tamanho, Gramatura. Nada é apagado — para tirar de uso, inative.
        </div>
        <div className="max-h-[46vh] overflow-auto">
          {variacoes.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Nenhuma variação cadastrada.</div>
          ) : variacoes.map((v) => (
            <div key={v.id} className={`flex items-stretch border-t ${selId === v.id ? "bg-teal-50" : ""}`}>
              <button
                type="button"
                onClick={() => setSelId(v.id)}
                className="flex-1 min-w-0 text-left px-3 py-2 hover:bg-muted/20"
              >
                <div className="text-[13px] font-medium flex items-center justify-between gap-2">
                  <span className="truncate">{v.nome}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                    {valores.filter((x) => x.variacao_id === v.id).length} valores
                  </span>
                </div>
                {!v.ativo && <div className="text-[11px] text-muted-foreground">inativo</div>}
              </button>
              <button
                type="button"
                title="Renomear"
                onClick={() => { setTipoEdit(v); setTipoNome(v.nome); setTipoOpen(true); }}
                className="px-2 text-muted-foreground hover:text-foreground hover:bg-muted/30"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => alternarTipo.mutate(v)}
                className="px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30"
              >
                {v.ativo ? "Inativar" : "Ativar"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <div className="px-3 py-2 bg-muted/40 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider">
            {sel ? `Valores de ${sel.nome}` : "Valores"}
          </span>
          <Button
            size="sm"
            className="h-7 bg-teal-600 hover:bg-teal-700 text-white"
            disabled={!selId}
            onClick={() => { setValorEdit(null); setValorTexto(""); setValorOpen(true); }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar valor
          </Button>
        </div>
        <div className="max-h-[46vh] overflow-auto">
          {!selId ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Escolha um tipo de variação à esquerda.</div>
          ) : valoresDoTipo.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Nenhum valor cadastrado neste tipo.</div>
          ) : valoresDoTipo.map((v) => (
            <div key={v.id} className="flex items-stretch border-t">
              <div className="flex-1 min-w-0 px-3 py-2">
                <div className="text-[13px] font-medium truncate">{v.valor}</div>
                {!v.ativo && <div className="text-[11px] text-muted-foreground">inativo</div>}
              </div>
              <button
                type="button"
                title="Renomear"
                onClick={() => { setValorEdit(v); setValorTexto(v.valor); setValorOpen(true); }}
                className="px-2 text-muted-foreground hover:text-foreground hover:bg-muted/30"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => alternarValor.mutate(v)}
                className="px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30"
              >
                {v.ativo ? "Inativar" : "Ativar"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={tipoOpen} onOpenChange={setTipoOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader><DialogTitle>{tipoEdit ? "Renomear variação" : "Nova variação"}</DialogTitle></DialogHeader>
          <Input value={tipoNome} onChange={(e) => setTipoNome(e.target.value)} placeholder="Ex.: Cor" className="h-9" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTipoOpen(false)}>Cancelar</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              disabled={salvarTipo.isPending}
              onClick={() => salvarTipo.mutate()}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={valorOpen} onOpenChange={setValorOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{valorEdit ? "Renomear valor" : `Novo valor${sel ? ` de ${sel.nome}` : ""}`}</DialogTitle>
          </DialogHeader>
          <Input value={valorTexto} onChange={(e) => setValorTexto(e.target.value)} placeholder="Ex.: Azul" className="h-9" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setValorOpen(false)}>Cancelar</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              disabled={salvarValor.isPending}
              onClick={() => salvarValor.mutate()}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
