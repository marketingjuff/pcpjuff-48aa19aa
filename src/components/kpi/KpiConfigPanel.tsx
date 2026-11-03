import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-role";
import { LIMITE_VOUCHER_PADRAO } from "@/lib/indicadores-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const CHAVE_LIMITE_VOUCHER = "kpi_store_limite_voucher";
export const QUERY_LIMITE_VOUCHER = ["map", "config", CHAVE_LIMITE_VOUCHER];

function numeroLimite(v: unknown): number | null {
  if (typeof v !== "number" && typeof v !== "string") return null;
  const texto = String(v).trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(texto)) return null;
  const n = Number(texto);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function limiteVoucherValido(v: unknown): number {
  return numeroLimite(v) ?? LIMITE_VOUCHER_PADRAO;
}

export async function lerLimiteVoucher(): Promise<number> {
  const { data, error } = await supabase.from("map_config").select("value").eq("key", CHAVE_LIMITE_VOUCHER).maybeSingle();
  if (error) throw error;
  return limiteVoucherValido(data?.value);
}

export function KpiConfigPanel() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: QUERY_LIMITE_VOUCHER, queryFn: lerLimiteVoucher });
  const limite = query.data ?? LIMITE_VOUCHER_PADRAO;
  const [texto, setTexto] = useState("");
  useEffect(() => { setTexto(limite.toFixed(2).replace(".", ",")); }, [limite]);
  const salvar = useMutation({
    mutationFn: async (n: number) => {
      if (!isAdmin) throw new Error("Somente administradores podem salvar o limite.");
      const { error } = await supabase.from("map_config").upsert({ key: CHAVE_LIMITE_VOUCHER, value: n, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_LIMITE_VOUCHER });
      toast.success("Limite de voucher salvo.");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível salvar o limite."),
  });
  function salvarLimite() {
    const n = numeroLimite(texto);
    if (n === null) { toast.error("Informe um valor maior ou igual a zero, com até duas casas decimais."); return; }
    salvar.mutate(n);
  }
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Juff Store</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="kpi-limite-voucher">Limite de preço para considerar a peça como voucher (R$)</Label>
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input id="kpi-limite-voucher" type="text" inputMode="decimal" value={texto} onChange={(e) => setTexto(e.target.value)} disabled={query.isLoading || salvar.isPending || query.isError} className="w-40" />
            <Button size="sm" onClick={salvarLimite} disabled={query.isLoading || salvar.isPending || query.isError}>{salvar.isPending ? "Salvando…" : "Salvar"}</Button>
          </div>
        ) : <p className="text-sm tabular-nums">{limite.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
        <p className="text-xs text-muted-foreground">Peças com preço unitário abaixo desse valor ficam fora da faixa “Venda real” do KPI Juff Store.</p>
        {query.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar o limite. Tente novamente antes de salvar.</p>}
      </CardContent>
    </Card>
  );
}