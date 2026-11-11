import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { areaExigeOficina, useAppList, useKindProblemaPorArea } from "@/lib/app-lists";

export type IdentificacaoErro = {
  areaIdentificou: string;
  dentroJuff: "sim" | "nao" | "";
  areaErro: string;
  problema: string;
};

export const IDENTIFICACAO_VAZIA: IdentificacaoErro = { areaIdentificou: "", dentroJuff: "", areaErro: "", problema: "" };

export function validarIdentificacaoErro(v: IdentificacaoErro, oficinaId: string): string | null {
  if (!v.areaIdentificou) return "Informe qual área identificou o problema.";
  if (v.dentroJuff === "") return "Informe se o erro foi dentro da Juff.";
  if (!v.areaErro) return v.dentroJuff === "sim" ? "Informe qual área da Juff errou." : "Informe quem errou de fora da Juff.";
  if (!v.problema) return "Informe qual foi o problema.";
  if (areaExigeOficina(v.areaErro) && !oficinaId) return "Informe qual oficina.";
  return null;
}

function Opcoes({ lista }: { lista: string[] }) {
  return lista.length === 0
    ? <div className="px-2 py-1.5 text-xs text-muted-foreground">Sem opções cadastradas.</div>
    : <>{lista.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</>;
}

export function IdentificacaoErroCampos({ value, onChange }: { value: IdentificacaoErro; onChange: (v: IdentificacaoErro) => void }) {
  const { names: areasIdentifica } = useAppList("refacao_area_identifica");
  const { names: areasInt } = useAppList("refacao_area_erro");
  const { names: areasExt } = useAppList("refacao_area_erro_externa");
  const kind = useKindProblemaPorArea(value.areaErro);
  const { names: problemas } = useAppList(kind);
  const areas = value.dentroJuff === "sim" ? areasInt : areasExt;
  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-3">
      <div className="text-[11px] text-muted-foreground font-medium uppercase">Identificação do problema</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Qual área identificou o problema? *</Label>
          <Select value={value.areaIdentificou} onValueChange={(v) => onChange({ ...value, areaIdentificou: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent><Opcoes lista={areasIdentifica} /></SelectContent>
          </Select>
        </div>
        <div>
          <Label>O erro foi dentro da Juff? *</Label>
          <Select value={value.dentroJuff} onValueChange={(v) => onChange({ ...value, dentroJuff: v as "sim" | "nao", areaErro: "", problema: "" })}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {value.dentroJuff !== "" && (
          <div>
            <Label>{value.dentroJuff === "sim" ? "Qual área da Juff errou? *" : "Quem errou de fora da Juff? *"}</Label>
            <Select value={value.areaErro} onValueChange={(v) => onChange({ ...value, areaErro: v, problema: "" })}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent><Opcoes lista={areas} /></SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label>Qual foi o problema? *</Label>
          <Select value={value.problema} onValueChange={(v) => onChange({ ...value, problema: v })} disabled={!value.areaErro}>
            <SelectTrigger><SelectValue placeholder={value.areaErro ? "Selecione…" : "Escolha a área primeiro"} /></SelectTrigger>
            <SelectContent><Opcoes lista={value.areaErro ? problemas : []} /></SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
