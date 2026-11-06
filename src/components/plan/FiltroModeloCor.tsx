import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, X } from "lucide-react";
import { REFACAO_CORES, REFACAO_MODELOS } from "@/lib/pedidos";
import type { FiltroPlan } from "@/lib/plan";
import { CorChip } from "./NecessidadeTab";

export function useFiltroModeloCor(aba: string) {
  const chave = `plan:filtros:${aba}`;
  const [filtro, setFiltro] = useState<FiltroPlan>({ modelos: [], cores: [] });
  useEffect(() => {
    try {
      const valor: unknown = JSON.parse(localStorage.getItem(chave) ?? "null");
      if (!valor || typeof valor !== "object") return;
      const raw = valor as Record<string, unknown>;
      setFiltro({
        modelos: Array.isArray(raw.modelos) ? raw.modelos.filter((m): m is string => typeof m === "string" && REFACAO_MODELOS.some(x => x === m)) : [],
        cores: Array.isArray(raw.cores) ? raw.cores.filter((c): c is string => typeof c === "string" && REFACAO_CORES.some(x => x.nome === c)) : [],
      });
    } catch { /* Uma seleção inválida não impede o acesso à grade. */ }
  }, [chave]);
  const mudar = (novo: FiltroPlan) => {
    setFiltro(novo);
    try { localStorage.setItem(chave, JSON.stringify(novo)); } catch { /* Mantém o filtro nesta sessão. */ }
  };
  return { filtro, mudar };
}

export function FiltroModeloCor({ filtro, mudar, modelos }: {
  filtro: FiltroPlan; mudar: (f: FiltroPlan) => void; modelos: string[];
}) {
  const [aberto, setAberto] = useState<"modelos" | "cores" | null>(null);
  const seletor = (campo: "modelos" | "cores", titulo: string, opcoes: string[]) => (
    <Popover open={aberto === campo} onOpenChange={open => setAberto(open ? campo : null)}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Filtrar ${titulo.toLowerCase()}`}>
          {titulo}{filtro[campo].length > 0 ? ` (${filtro[campo].length})` : ""}<ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 max-h-80 overflow-y-auto" align="start">
        <div className="space-y-2">
          {opcoes.map(valor => (
            <label key={valor} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox aria-label={`Filtrar ${campo === "cores" ? "cor" : "modelo"} ${valor}`} checked={filtro[campo].includes(valor)} onCheckedChange={checked => {
                mudar({ ...filtro, [campo]: checked === true ? [...filtro[campo], valor] : filtro[campo].filter(x => x !== valor) });
              }} />
              {campo === "cores" ? <CorChip cor={valor} /> : valor}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {seletor("modelos", "Modelos", modelos)}
      {seletor("cores", "Cores", REFACAO_CORES.map(c => c.nome))}
      {(filtro.modelos.length > 0 || filtro.cores.length > 0) && <Button variant="ghost" size="sm" onClick={() => mudar({ modelos: [], cores: [] })}><X className="h-4 w-4" />Limpar filtro</Button>}
    </div>
  );
}