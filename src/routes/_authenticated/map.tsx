import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";
import logoJuff from "@/assets/logo-juff.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useMyRoles, useCanAccessMap } from "@/hooks/use-role";
import { MacroSwitch } from "@/routes/_authenticated/cop";
import { ProgramacaoFiosTab } from "@/components/map/ProgramacaoFiosTab";
import { FiosFinalizadosTab } from "@/components/map/FiosFinalizadosTab";
import { EstoqueMpTab } from "@/components/map/EstoqueMpTab";
import { QuebraTab } from "@/components/map/QuebraTab";
import { DevolucoesTab } from "@/components/map/DevolucoesTab";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/map")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
    prodId: typeof s.prodId === "string" ? s.prodId : undefined,
  }),
  component: MapHome,
});

const TABS = [
  { value: "programacao", label: "Prod. de Tecido" },
  { value: "finalizados", label: "Prod. Finalizados" },
  { value: "estoque", label: "Estoque de MP" },
  { value: "quebra", label: "Quebra" },
  { value: "devolucoes", label: "Devoluções" },
];

function MapHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canAccess = useCanAccessMap();
  const { isLoading } = useMyRoles();
  const search = Route.useSearch();
  const [tab, setTabState] = useState(() => {
    if (search.tab) return search.tab;
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("map:tab");
      if (saved) return saved;
    }
    return "programacao";
  });
  const setTab = (t: string) => {
    setTabState(t);
    if (typeof window !== "undefined") window.localStorage.setItem("map:tab", t);
  };

  useEffect(() => {
    if (search.tab) setTabState(search.tab);
  }, [search.tab]);

  useEffect(() => {
    if (!isLoading && !canAccess) {
      toast.error("MAP é restrito a administradores e gestores autorizados.");
      navigate({ to: "/", replace: true });
    }
  }, [canAccess, isLoading, navigate]);

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
              <h1 className="font-display text-base sm:text-lg font-semibold leading-tight tracking-tight truncate">MAP Juff</h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Matéria Prima</p>
            </div>
          </div>
          <div className="flex justify-center">
            <MacroSwitch active="map" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/configuracoes", search: { area: "map" } as any })} aria-label="Configurações">
              <Settings className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Configurações</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Sair">
              <LogOut className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 sm:py-6 bg-yellow-50/60 rounded-b-xl">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap mb-6">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="programacao" forceMount hidden={tab !== "programacao"}>
            <ProgramacaoFiosTab prodId={search.prodId} />
          </TabsContent>
          <TabsContent value="finalizados" forceMount hidden={tab !== "finalizados"}>
            <FiosFinalizadosTab />
          </TabsContent>
          <TabsContent value="estoque" forceMount hidden={tab !== "estoque"}>
            <EstoqueMpTab />
          </TabsContent>
          <TabsContent value="quebra" forceMount hidden={tab !== "quebra"}>
            <QuebraTab />
          </TabsContent>
          <TabsContent value="devolucoes" forceMount hidden={tab !== "devolucoes"}>
            <DevolucoesTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
