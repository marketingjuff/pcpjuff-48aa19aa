import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";
import logoJuff from "@/assets/logo-juff.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useMyRoles, useCanAccessSup, useIsAdmin, useAbasPermitidas, useMinhasPermissoes } from "@/hooks/use-role";
import { rotaInicial } from "@/lib/permissoes";
import { MacroSwitch } from "@/routes/_authenticated/cop";
import { ProdutosTab } from "@/components/sup/ProdutosTab";
import { PedidosCompraTab } from "@/components/sup/PedidosCompraTab";
import { ComissoesTab } from "@/components/sup/ComissoesTab";
import { DashboardSupTab } from "@/components/sup/DashboardSupTab";
import { MonitorPrecosTab } from "@/components/sup/MonitorPrecosTab";
import { HistoricoSupTab } from "@/components/sup/HistoricoSupTab";

export const Route = createFileRoute("/_authenticated/sup")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
    pcId: typeof s.pcId === "string" ? s.pcId : undefined,
    fornecedorId: typeof s.fornecedorId === "string" ? s.fornecedorId : undefined,
  }) as { tab?: string; pcId?: string; fornecedorId?: string },
  component: SupHome,
  head: () => ({
    meta: [
      { title: "SUP Juff — Suprimentos e Pedidos de Compra" },
      { name: "description", content: "Controle de suprimentos Juff: fornecedores, produtos, histórico de preços, pedidos de compra e comissão por economia." },
      { property: "og:title", content: "SUP Juff — Suprimentos" },
      { property: "og:description", content: "Fornecedores, produtos, pedidos de compra e apuração de comissão sobre economia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SupHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canAccess = useCanAccessSup();
  const isAdmin = useIsAdmin();
  const { data: myRoles = [], isLoading } = useMyRoles();
  const isGestor = myRoles.some((r) => r.role === "gestor");
  const abas = useAbasPermitidas("sup");
  const permissoes = useMinhasPermissoes();
  const pode = (k: string) => permissoes.has(k);
  const TABS = [
    ...abas.map((a) => ({ value: a.tabValue, label: a.label })),
    ...(isAdmin
      ? [{ value: "monitor-precos", label: "Monitor de Preços" }, { value: "historico", label: "Histórico SUP" }]
      : []),
  ];
  const search = Route.useSearch();
  const [tab, setTabState] = useState(() => {
    const valid = (t: string | null) => {
      if (!t) return null;
      if (t === "alteracoes-preco") return "monitor-precos";
      return ["produtos", "pedidos", "comissoes", "dashboard", "monitor-precos", "historico"].includes(t) ? t : null;
    };
    const daUrl = valid(search.tab ?? null);
    if (daUrl) return daUrl;
    if (typeof window !== "undefined") {
      const saved = valid(window.localStorage.getItem("sup:tab"));
      if (saved) return saved;
    }
    return "pedidos";
  });
  const setTab = (t: string) => {
    setTabState(t);
    if (typeof window !== "undefined") window.localStorage.setItem("sup:tab", t);
    navigate({ to: "/sup", search: (prev: any) => ({ ...prev, tab: t }), replace: true });
  };

  useEffect(() => {
    if (search.tab) setTabState(search.tab === "alteracoes-preco" ? "monitor-precos" : search.tab);
  }, [search.tab]);

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
              <h1 className="font-display text-base sm:text-lg font-semibold leading-tight tracking-tight truncate">SUP Juff</h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Suprimentos</p>
            </div>
          </div>
          <div className="flex justify-center">
            <MacroSwitch active="sup" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {(isAdmin || isGestor) && (
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/configuracoes", search: { area: "sup" } as any })} aria-label="Configurações">
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

      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 sm:py-6 bg-teal-50/60 rounded-b-xl">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap mb-6">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {pode("sup.produtos") && (
          <TabsContent value="produtos" forceMount hidden={tab !== "produtos"}>
            <ProdutosTab />
          </TabsContent>
          )}
          {pode("sup.pedidos") && (
          <TabsContent value="pedidos" forceMount hidden={tab !== "pedidos"}>
            <PedidosCompraTab pcId={search.pcId} fornecedorId={search.fornecedorId} />
          </TabsContent>
          )}
          {pode("sup.comissoes") && (
          <TabsContent value="comissoes" forceMount hidden={tab !== "comissoes"}>
            <ComissoesTab />
          </TabsContent>
          )}
          {pode("sup.dashboard") && (
          <TabsContent value="dashboard" forceMount hidden={tab !== "dashboard"}>
            <DashboardSupTab />
          </TabsContent>
          )}
          {isAdmin && (
            <>
              <TabsContent value="monitor-precos" forceMount hidden={tab !== "monitor-precos"}>
                <MonitorPrecosTab />
              </TabsContent>
              <TabsContent value="historico" forceMount hidden={tab !== "historico"}>
                <HistoricoSupTab />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  );
}
