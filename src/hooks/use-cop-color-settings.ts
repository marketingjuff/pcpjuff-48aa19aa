import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CSSProperties } from "react";

export type ColorPair = { fg: string; bg: string };
export type CopBotaoKey = "atualizar" | "mandar_romaneio" | "dividir_corte" | "voltar";

export const COP_ETAPAS_CONFIGURAVEIS: string[] = [
  "Aguardando Risco",
  "Aguardando Corte",
  "Aguardando Romaneio",
  "Em Oficina",
  "Aguardando Pagamento",
  "Finalizado",
];

export const DEFAULT_COP_ETAPA_COLORS: Record<string, ColorPair> = {
  "Aguardando Risco":      { bg: "#fef3c7", fg: "#92400e" },
  "Aguardando Corte":      { bg: "#ffedd5", fg: "#9a3412" },
  "Aguardando Romaneio":   { bg: "#eef2ff", fg: "#3730a3" },
  "Em Oficina":            { bg: "#ccfbf1", fg: "#115e59" },
  "Aguardando Pagamento":  { bg: "#fce7f3", fg: "#9f1239" },
  "Finalizado":            { bg: "#dcfce7", fg: "#15803d" },
};

export const DEFAULT_COP_BOTAO_COLORS: Record<CopBotaoKey, ColorPair> = {
  atualizar:       { bg: "#2563eb", fg: "#ffffff" },
  mandar_romaneio: { bg: "#059669", fg: "#ffffff" },
  dividir_corte:   { bg: "#ff8c2f", fg: "#ffffff" },
  voltar:          { bg: "#cf0e0e", fg: "#ffffff" },
};

export type CopColorSettings = {
  etapas: Record<string, ColorPair>;
  botoes: Record<CopBotaoKey, ColorPair>;
};

export const DEFAULT_COP_COLOR_SETTINGS: CopColorSettings = {
  etapas: { ...DEFAULT_COP_ETAPA_COLORS },
  botoes: { ...DEFAULT_COP_BOTAO_COLORS },
};

const QKEY = ["cop-color-settings"] as const;

function mergeSettings(raw: any): CopColorSettings {
  const etapas: Record<string, ColorPair> = { ...DEFAULT_COP_ETAPA_COLORS };
  const botoes: Record<CopBotaoKey, ColorPair> = { ...DEFAULT_COP_BOTAO_COLORS };
  if (raw && typeof raw === "object") {
    if (raw.etapas && typeof raw.etapas === "object") {
      for (const k of Object.keys(raw.etapas)) {
        const v = raw.etapas[k];
        if (v && typeof v.bg === "string" && typeof v.fg === "string") etapas[k] = { bg: v.bg, fg: v.fg };
      }
    }
    if (raw.botoes && typeof raw.botoes === "object") {
      for (const k of ["atualizar", "mandar_romaneio", "dividir_corte", "voltar"] as CopBotaoKey[]) {
        const v = raw.botoes[k];
        if (v && typeof v.bg === "string" && typeof v.fg === "string") botoes[k] = { bg: v.bg, fg: v.fg };
      }
    }
  }
  return { etapas, botoes };
}

export function useCopColorSettings() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: QKEY,
    queryFn: async (): Promise<CopColorSettings> => {
      const { data, error } = await supabase
        .from("app_color_settings" as any)
        .select("data")
        .eq("id", "cop")
        .maybeSingle();
      if (error) return DEFAULT_COP_COLOR_SETTINGS;
      return mergeSettings((data as any)?.data);
    },
    staleTime: 5 * 60 * 1000,
  });

  const settings = query.data ?? DEFAULT_COP_COLOR_SETTINGS;

  function etapaStyle(etapa: string | undefined | null): CSSProperties {
    if (!etapa) return {};
    const pair = settings.etapas[etapa];
    if (!pair) return {};
    return {
      backgroundColor: pair.bg,
      color: pair.fg,
      borderColor: `color-mix(in oklab, ${pair.fg} 35%, transparent)`,
    };
  }

  function btnStyle(key: CopBotaoKey): CSSProperties {
    const pair = settings.botoes[key] ?? DEFAULT_COP_BOTAO_COLORS[key];
    return { backgroundColor: pair.bg, color: pair.fg, borderColor: pair.bg };
  }

  const save = useMutation({
    mutationFn: async (next: CopColorSettings) => {
      const { error } = await supabase
        .from("app_color_settings" as any)
        .upsert({ id: "cop", data: next as any }, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QKEY }),
  });

  return { settings, etapaStyle, btnStyle, isLoading: query.isLoading, save };
}
