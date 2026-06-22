import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CSSProperties } from "react";

export type ColorPair = { fg: string; bg: string };
export type BotaoKey = "atualizar" | "finalizar" | "voltar";

export const ETAPAS_CONFIGURAVEIS: string[] = [
  "Aguardando entrada",
  "Aguardando input de produção",
  "Aguardando Arte",
  "DTF Liberado / Silk na Arte",
  "Silk Pronto / DTF na Arte",
  "Aguardando DTF",
  "Aguardando Silk",
  "Aguardando DTF + Silk",
  "Aguardando Acabamento",
  "Aguardando Expedição",
  "Finalizado",
];

export const DEFAULT_ETAPA_COLORS: Record<string, ColorPair> = {
  "Aguardando entrada": { bg: "#f1f5f9", fg: "#475569" },
  "Aguardando input de produção": { bg: "#fef3c7", fg: "#92400e" },
  "Aguardando Arte": { bg: "#eef2ff", fg: "#3730a3" },
  "DTF Liberado / Silk na Arte": { bg: "#eef2ff", fg: "#3730a3" },
  "Silk Pronto / DTF na Arte": { bg: "#eef2ff", fg: "#3730a3" },
  "Aguardando DTF": { bg: "#ccfbf1", fg: "#115e59" },
  "Aguardando Silk": { bg: "#f3e8ff", fg: "#6b21a8" },
  "Aguardando DTF + Silk": { bg: "#f3e8ff", fg: "#6b21a8" },
  "Aguardando Acabamento": { bg: "#fef3c7", fg: "#92400e" },
  "Aguardando Expedição": { bg: "#fce7f3", fg: "#9f1239" },
  Finalizado: { bg: "#dcfce7", fg: "#15803d" },
};

export const DEFAULT_BOTAO_COLORS: Record<BotaoKey, ColorPair> = {
  atualizar: { bg: "#2563eb", fg: "#ffffff" },
  finalizar: { bg: "#059669", fg: "#ffffff" },
  voltar: { bg: "#cf0e0e", fg: "#ffffff" },
};

export type ColorSettings = {
  etapas: Record<string, ColorPair>;
  botoes: Record<BotaoKey, ColorPair>;
};

export const DEFAULT_COLOR_SETTINGS: ColorSettings = {
  etapas: { ...DEFAULT_ETAPA_COLORS },
  botoes: { ...DEFAULT_BOTAO_COLORS },
};

const QKEY = ["color-settings"] as const;

function mergeSettings(raw: any): ColorSettings {
  const etapas: Record<string, ColorPair> = { ...DEFAULT_ETAPA_COLORS };
  const botoes: Record<BotaoKey, ColorPair> = { ...DEFAULT_BOTAO_COLORS };
  if (raw && typeof raw === "object") {
    if (raw.etapas && typeof raw.etapas === "object") {
      for (const k of Object.keys(raw.etapas)) {
        const v = raw.etapas[k];
        if (v && typeof v.bg === "string" && typeof v.fg === "string") etapas[k] = { bg: v.bg, fg: v.fg };
      }
    }
    if (raw.botoes && typeof raw.botoes === "object") {
      for (const k of ["atualizar", "finalizar", "voltar"] as BotaoKey[]) {
        const v = raw.botoes[k];
        if (v && typeof v.bg === "string" && typeof v.fg === "string") botoes[k] = { bg: v.bg, fg: v.fg };
      }
    }
  }
  return { etapas, botoes };
}

export function useColorSettings() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: QKEY,
    queryFn: async (): Promise<ColorSettings> => {
      const { data, error } = await supabase
        .from("app_color_settings" as any)
        .select("data")
        .eq("id", "global")
        .maybeSingle();
      if (error) return DEFAULT_COLOR_SETTINGS;
      return mergeSettings((data as any)?.data);
    },
    staleTime: 5 * 60 * 1000,
  });

  const settings = query.data ?? DEFAULT_COLOR_SETTINGS;

  function etapaStyle(etapa: string | undefined | null): CSSProperties {
    if (!etapa) return {};
    const key = etapa.replace(/\*$/, "").trim();
    const pair = settings.etapas[key];
    if (!pair) return {};
    return {
      backgroundColor: pair.bg,
      color: pair.fg,
      borderColor: `color-mix(in oklab, ${pair.fg} 35%, transparent)`,
    };
  }

  function btnStyle(key: BotaoKey): CSSProperties {
    const pair = settings.botoes[key] ?? DEFAULT_BOTAO_COLORS[key];
    return {
      backgroundColor: pair.bg,
      color: pair.fg,
      borderColor: pair.bg,
    };
  }

  const save = useMutation({
    mutationFn: async (next: ColorSettings) => {
      const { error } = await supabase
        .from("app_color_settings" as any)
        .upsert({ id: "global", data: next as any }, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QKEY }),
  });

  return { settings, etapaStyle, btnStyle, isLoading: query.isLoading, save };
}
