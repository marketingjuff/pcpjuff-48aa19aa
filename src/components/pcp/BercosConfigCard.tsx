import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useBercos, useSalvarBercos } from "@/hooks/use-bercos";

function exemplo(prefixo: string, v: string) {
  const n = Number(v);
  if (!v || !Number.isFinite(n) || n <= 0) return "Nenhum berço cadastrado.";
  return n === 1 ? `${prefixo}1` : `${prefixo}1 até ${prefixo}${n}`;
}

export function BercosConfigCard() {
  const { qtd, isLoading } = useBercos();
  const salvar = useSalvarBercos();
  const [dtf, setDtf] = useState("");
  const [silk, setSilk] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    setDtf(qtd.dtf ? String(qtd.dtf) : "");
    setSilk(qtd.silk ? String(qtd.silk) : "");
  }, [isLoading, qtd.dtf, qtd.silk]);

  async function onSalvar() {
    setErro(null);
    try {
      await salvar.mutateAsync({ dtf: dtf ? Number(dtf) : null, silk: silk ? Number(silk) : null });
      toast.success("Berços salvos.");
    } catch (e: any) {
      setErro(e?.message ?? "Não foi possível salvar.");
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Berços</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Quantidade de berços de DTF</Label>
            <Input type="text" inputMode="numeric" value={dtf} onChange={(e) => setDtf(e.target.value.replace(/\D/g, ""))} />
            <div className="text-xs text-muted-foreground mt-1">{exemplo("D", dtf)}</div>
          </div>
          <div>
            <Label>Quantidade de berços de Silk</Label>
            <Input type="text" inputMode="numeric" value={silk} onChange={(e) => setSilk(e.target.value.replace(/\D/g, ""))} />
            <div className="text-xs text-muted-foreground mt-1">{exemplo("S", silk)}</div>
          </div>
        </div>
        {erro && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</div>}
        <Button onClick={onSalvar} disabled={salvar.isPending || isLoading}>{salvar.isPending ? "Salvando…" : "Salvar"}</Button>
      </CardContent>
    </Card>
  );
}
