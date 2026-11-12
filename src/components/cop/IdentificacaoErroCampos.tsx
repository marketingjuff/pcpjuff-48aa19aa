import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { areaExigeOficina, tipoBercoDoProblema, useAppList, useKindProblemaPorArea } from "@/lib/app-lists";
import { ordenarOficinas, rotuloOficina } from "@/lib/cop";
import { useBercos } from "@/hooks/use-bercos";

export type IdentificacaoErro = {
  areaIdentificou: string;
  dentroJuff: "sim" | "nao" | "";
  areaErro: string;
  problema: string;
};

export const IDENTIFICACAO_VAZIA: IdentificacaoErro = { areaIdentificou: "", dentroJuff: "", areaErro: "", problema: "" };

/** Lista de berços aplicável ao problema escolhido (vazia quando não pede berço). */
export function useBercosDoProblema(areaErro: string, problema: string): { pede: boolean; lista: string[] } {
  const bercos = useBercos();
  const tipo = tipoBercoDoProblema(areaErro, problema);
  return { pede: tipo != null, lista: tipo ? bercos[tipo] : [] };
}

export function useOficinasOrdenadas() {
  const { data = [] } = useQuery({
    queryKey: ["oficinas", "codigo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas").select("id, nome, codigo");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; codigo: number | null }[];
    },
  });
  return ordenarOficinas(data);
}

export function validarIdentificacaoErro(v: IdentificacaoErro, oficinaId: string, berco: string = "", bercosDisponiveis: string[] = []): string | null {
  if (!v.areaIdentificou) return "Informe qual área identificou o problema.";
  if (v.dentroJuff === "") return "Informe se o erro foi dentro da Juff.";
  if (!v.areaErro) return v.dentroJuff === "sim" ? "Informe qual área da Juff errou." : "Informe quem errou de fora da Juff.";
  if (!v.problema) return "Informe qual foi o problema.";
  if (areaExigeOficina(v.areaErro) && !oficinaId) return "Informe qual oficina.";
  if (tipoBercoDoProblema(v.areaErro, v.problema) && bercosDisponiveis.length > 0 && !berco) return "Informe qual berço.";
  return null;
}

function Opcoes({ lista }: { lista: string[] }) {
  return lista.length === 0
    ? <div className="px-2 py-1.5 text-xs text-muted-foreground">Sem opções cadastradas.</div>
    : <>{lista.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</>;
}

/** Selects "Qual oficina?" e "Qual berço?" — aparecem só quando a regra pede. */
export function OficinaBercoCampos({ areaErro, problema, oficinaId, onOficinaChange, berco, onBercoChange }: {
  areaErro: string; problema: string;
  oficinaId: string; onOficinaChange: (v: string) => void;
  berco: string; onBercoChange: (v: string) => void;
}) {
  const oficinas = useOficinasOrdenadas();
  const { pede, lista } = useBercosDoProblema(areaErro, problema);
  return (
    <>
      {areaExigeOficina(areaErro) && (
        <div>
          <Label>Qual oficina? *</Label>
          <Select value={oficinaId} onValueChange={onOficinaChange}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {oficinas.length === 0
                ? <div className="px-2 py-1.5 text-xs text-muted-foreground">Sem oficinas cadastradas.</div>
                : oficinas.map((o) => <SelectItem key={o.id} value={o.id}>{rotuloOficina(o)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {pede && (
        <div>
          <Label>Qual berço? *</Label>
          {lista.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">Cadastre a quantidade de berços nas Configurações.</div>
          ) : (
            <Select value={berco} onValueChange={onBercoChange}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>{lista.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      )}
    </>
  );
}

export function IdentificacaoErroCampos({ value, onChange, oficinaId = "", onOficinaChange, berco = "", onBercoChange }: {
  value: IdentificacaoErro; onChange: (v: IdentificacaoErro) => void;
  oficinaId?: string; onOficinaChange?: (v: string) => void;
  berco?: string; onBercoChange?: (v: string) => void;
}) {
  // Troca de área/problema limpa oficina e berço que deixam de valer.
  function mudar(n: IdentificacaoErro) {
    if (onOficinaChange && oficinaId && !areaExigeOficina(n.areaErro)) onOficinaChange("");
    if (onBercoChange && berco && (n.areaErro !== value.areaErro || n.problema !== value.problema)) onBercoChange("");
    onChange(n);
  }
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
          <Select value={value.dentroJuff} onValueChange={(v) => mudar({ ...value, dentroJuff: v as "sim" | "nao", areaErro: "", problema: "" })}>
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
            <Select value={value.areaErro} onValueChange={(v) => mudar({ ...value, areaErro: v, problema: "" })}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent><Opcoes lista={areas} /></SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label>Qual foi o problema? *</Label>
          <Select value={value.problema} onValueChange={(v) => mudar({ ...value, problema: v })} disabled={!value.areaErro}>
            <SelectTrigger><SelectValue placeholder={value.areaErro ? "Selecione…" : "Escolha a área primeiro"} /></SelectTrigger>
            <SelectContent><Opcoes lista={value.areaErro ? problemas : []} /></SelectContent>
          </Select>
        </div>
        {onOficinaChange && onBercoChange && (
          <OficinaBercoCampos areaErro={value.areaErro} problema={value.problema}
            oficinaId={oficinaId} onOficinaChange={onOficinaChange} berco={berco} onBercoChange={onBercoChange} />
        )}
      </div>
    </div>
  );
}
