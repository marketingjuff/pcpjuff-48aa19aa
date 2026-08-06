import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";
import logoJuff from "@/assets/logo-juff.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useMyRoles, useIsAdmin, useCanAccessKpi, useAbasPermitidas, useMinhasPermissoes } from "@/hooks/use-role";
import { rotaInicial } from "@/lib/permissoes";
import { MacroSwitch } from "@/routes/_authenticated/cop";
import { ImportacaoOlistTab } from "@/components/kpi/ImportacaoOlistTab";
import { IndicadoresTab } from "@/components/kpi/IndicadoresTab";
import { KpiPcpTab } from "@/components/kpi/KpiPcpTab";

export const Route = createFileRoute("/_authenticated/kpi")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
  }) as { tab?: string },
  component: KpiHome,
});

function KpiHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const isGestor = useMyRoles().data?.some((r) => r.role === "gestor") ?? false;
  const canAccess = useCanAccessKpi();
  const abas = useAbasPermitidas("kpi");
  const permissoes = useMinhasPermissoes();
  const pode = (k: string) => permissoes.has(k);
  const TABS = abas.map((a) => ({ value: a.tabValue, label: a.label }));
  const { isLoading } = useMyRoles();
  const search = Route.useSearch();
  const [tab, setTabState] = useState(() => {
    if (search.tab) return search.tab;
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("kpi:tab");
      if (saved) return saved;
    }
    return abas[0]?.tabValue ?? "custom";
  });
  const setTab = (t: string) => {
    setTabState(t);
    if (typeof window !== "undefined") window.localStorage.setItem("kpi:tab", t);
    navigate({ to: "/kpi", search: (prev: any) => ({ ...prev, tab: t }), replace: true });
  };

  useEffect(() => {
    if (search.tab) setTabState(search.tab);
  }, [search.tab]);

  // Abas já visitadas continuam montadas (hidden) para preservar filtros e estado.
  const visitadas = useRef<Set<string>>(new Set([tab]));
  visitadas.current.add(tab);
  const montada = (v: string) => visitadas.current.has(v);

  const primeiraAba = TABS[0]?.value;
  useEffect(() => {
    if (isLoading || !primeiraAba) return;
    if (!TABS.some((t) => t.value === tab)) setTab(primeiraAba);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, primeiraAba, tab]);

  const destino = rotaInicial(permissoes, isAdmin);
  useEffect(() => {
    if (isLoading || canAccess) return;
    navigate({ to: destino as any, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, isLoading, destino]);

  async function handleLogout() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading || !canAccess) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="max-w-[1600px] mx-auto grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={logoJuff.url} alt="Logo Juff" className="hidden sm:block h-10 w-10 rounded-xl object-cover ring-1 ring-primary/15 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-semibold leading-tight tracking-tight truncate">KPI Juff</h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Indicadores e monitoramento</p>
            </div>
          </div>
          <div className="flex justify-center">
            <MacroSwitch active="kpi" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {(isAdmin || isGestor) && (
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/configuracoes", search: { origem: "/kpi" } as any })} aria-label="Configurações">
                <Settings className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Configurações</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Sair">
              <LogOut className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 sm:py-6 bg-purple-50/60 rounded-b-xl">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap mb-6">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {montada("importolist") && pode("kpi.importolist") && (
            <TabsContent value="importolist" forceMount hidden={tab !== "importolist"}>
              <ImportacaoOlistTab />
            </TabsContent>
          )}
          {montada("custom") && pode("kpi.custom") && (
            <TabsContent value="custom" forceMount hidden={tab !== "custom"}>
              <IndicadoresTab escopo="custom" />
            </TabsContent>
          )}
          {montada("store") && pode("kpi.store") && (
            <TabsContent value="store" forceMount hidden={tab !== "store"}>
              <IndicadoresTab escopo="store" />
            </TabsContent>
          )}
          {montada("pcp") && pode("kpi.pcp") && (
            <TabsContent value="pcp" forceMount hidden={tab !== "pcp"}>
              <KpiPcpTab />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
