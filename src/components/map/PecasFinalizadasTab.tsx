import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEstoquePecas, patchEstoquePeca, fmtDateBR, corBase, type MapEstoquePeca } from "@/lib/map";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";

export function PecasFinalizadasTab() {
  const { data: pecas = [], isLoading } = useEstoquePecas();

  const { data: prodNumeroMap = {} } = useQuery({
    queryKey: ["map", "producoes", "numero-map"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("map_producoes")
        .select("id, numero");
      if (error) throw error;
      const m: Record<string, number> = {};
      for (const r of (data ?? []) as any[]) m[r.id] = r.numero;
      return m;
    },
    staleTime: 30_000,
  });

  const [fCor, setFCor] = useState<string>("");
  const [fNF, setFNF] = useState<string>("");
  const [fNE, setFNE] = useState<string>("");

  const finalizadas = useMemo(() => {
    return pecas
      .filter((p) => p.status === "100% utilizada")
      .filter((p) =>
        fCor.trim() === "" ? true : (corBase(p.cor) ?? "").toLowerCase().includes(fCor.trim().toLowerCase()),
      )
      .filter((p) =>
        fNF.trim() === "" ? true : (p.nota_fiscal ?? "").toLowerCase().includes(fNF.trim().toLowerCase()),
      )
      .filter((p) =>
        fNE.trim() === "" ? true : String(p.ne ?? "").includes(fNE.trim()),
      )
      .sort((a, b) => {
        const na = a.ne ?? Number.MAX_SAFE_INTEGER;
        const nb = b.ne ?? Number.MAX_SAFE_INTEGER;
        return na - nb;
      });
  }, [pecas, fCor, fNF, fNE]);

  const totalUtilizado = useMemo(
    () =>
      finalizadas.reduce(
        (s, p) => s + (p.cortes ?? []).reduce((ss, c) => ss + Number(c.metros ?? 0), 0),
        0,
      ),
    [finalizadas],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Cor"
          value={fCor}
          onChange={(e) => setFCor(e.target.value)}
          className="h-8 w-[140px] text-xs"
        />
        <Input
          placeholder="NE"
          value={fNE}
          onChange={(e) => setFNE(e.target.value)}
          className="h-8 w-[100px] text-xs"
        />
        <Input
          placeholder="Buscar NF…"
          value={fNF}
          onChange={(e) => setFNF(e.target.value)}
          className="h-8 w-[160px] text-xs"
        />
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {finalizadas.length} peça(s) • {totalUtilizado.toFixed(2)} m utilizados
        </span>
      </div>

      <div className="rounded-md border bg-white/70 overflow-x-auto">
        <table className="w-full text-[12.5px] table-fixed">
          <colgroup>
            <col style={{ width: "6%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "7%" }} />
          </colgroup>
          <thead className="bg-muted/40 sticky top-0">
            <tr>
              <th className="p-1 font-medium text-center">NE</th>
              <th className="p-1 font-medium text-center">PROD</th>
              <th className="p-1 font-medium text-center">NF</th>
              <th className="p-1 font-medium text-center">Cor</th>
              <th className="p-1 font-medium text-center">Data entrada</th>
              <th className="p-1 font-medium text-center">Nº peça</th>
              <th className="p-1 font-medium text-center">Abertura</th>
              <th className="p-1 font-medium text-center">Larg (m)</th>
              <th className="p-1 font-medium text-center">Alt (m)</th>
              <th className="p-1 font-medium text-center">Cortes</th>
              <th className="p-1 font-medium text-center">Total (m)</th>
            </tr>
          </thead>
          <tbody>
            {finalizadas.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-3 text-center text-muted-foreground">
                  {isLoading ? "Carregando…" : "Nenhuma peça finalizada."}
                </td>
              </tr>
            ) : (
              finalizadas.map((p, i) => {
                const bg = corHex(corBase(p.cor));
                const fg = corTextoSobre(bg);
                const somaCortes = (p.cortes ?? []).reduce(
                  (s, c) => s + Number(c.metros ?? 0),
                  0,
                );
                const prodNumero = prodNumeroMap[p.producao_id];
                return (
                  <tr
                    key={p.id}
                    className={`border-t ${i % 2 === 1 ? "bg-muted/20" : ""}`}
                  >
                    <td className="p-1 text-center tabular-nums font-semibold">
                      {p.ne != null ? `NE${p.ne}` : "—"}
                    </td>
                    <td className="p-1 text-center tabular-nums">
                      {prodNumero != null ? `PROD${prodNumero}` : "—"}
                    </td>
                    <td className="p-1 text-center truncate" title={p.nota_fiscal ?? ""}>
                      {p.nota_fiscal ?? "—"}
                    </td>
                    <td className="p-1 text-center">
                      <span
                        className="inline-block rounded-sm px-1.5 py-0.5 text-[11.5px] font-semibold"
                        style={{ backgroundColor: bg, color: fg }}
                        title={p.cor ?? ""}
                      >
                        {corBase(p.cor) || "—"}
                      </span>
                    </td>
                    <td className="p-1 text-center tabular-nums">{fmtDateBR(p.data_entrada)}</td>
                    <td className="p-1 text-center">{p.numero_peca ?? "—"}</td>
                    <td className="p-1 text-center tabular-nums">{fmtDateBR(p.data_abertura)}</td>
                    <td className="p-1 text-center tabular-nums">
                      {p.larg != null ? Number(p.larg).toFixed(3).replace(".", ",") : "—"}
                    </td>
                    <td className="p-1 text-center tabular-nums">
                      {p.alt_inicial != null ? Number(p.alt_inicial).toFixed(2) : "—"}
                    </td>
                    <td className="p-1">
                      {(p.cortes ?? []).length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(p.cortes ?? []).map((c, idx) => (
                            <span
                              key={idx}
                              className="inline-block rounded-sm bg-muted/70 px-1.5 py-0.5 text-[11px] tabular-nums"
                              title={`COP ${c.cop_numero}${c.letra ? c.letra : ""} • ${fmtDateBR(c.data)}`}
                            >
                              COP{c.cop_numero}
                              {c.letra ?? ""}: {Number(c.metros).toFixed(2)}m
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-1 text-center tabular-nums font-semibold">
                      {somaCortes.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
