import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";
import logoJuff from "@/assets/logo-juff.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useMyRoles, useCanAccessSup, useIsAdmin } from "@/hooks/use-role";
import { MacroSwitch } from "@/routes/_authenticated/cop";
import { FornecedoresTab } from "@/components/sup/FornecedoresTab";
import { ProdutosTab } from "@/components/sup/ProdutosTab";
import { PedidosCompraTab } from "@/components/sup/PedidosCompraTab";
import { ComissoesTab } from "@/components/sup/ComissoesTab";
import { DashboardSupTab } from "@/components/sup/DashboardSupTab";
import { AlteracoesPrecoTab } from "@/components/sup/AlteracoesPrecoTab";
import { SupConfigTab } from "@/components/sup/SupConfigTab";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sup")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
    pcId: typeof s.pcId === "string" ? s.pcId : undefined,
    fornecedorId: typeof s.fornecedorId === "string" ? s.fornecedorId : undefined,
  }),
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

const BASE_TABS = [
  { value: "fornecedores", label: "Fornecedores" },
  { value: "produtos", label: "Produtos" },
  { value: "pedidos", label: "Pedidos de Compra" },
  { value: "comissoes", label: "Comissões" },
  { value: "dashboard", label: "Dashboard SUP" },
];

function SupHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canAccess = useCanAccessSup();
  const isAdmin = useIsAdmin();
  const { isLoading } = useMyRoles();
  const TABS = isAdmin
    ? [...BASE_TABS, { value: "alteracoes-preco", label: "Alterações de Preço" }, { value: "config", label: "Configurações SUP" }]
    : BASE_TABS;
  const search = Route.useSearch();
  const [tab, setTabState] = useState(() => {
    if (search.tab) return search.tab;
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("sup:tab");
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
    if (search.tab) setTabState(search.tab);
  }, [search.tab]);

  useEffect(() => {
    if (!isLoading && !canAccess) {
      toast.error("SUP é restrito a administradores e gestores autorizados.");
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
              <h1 className="font-display text-base sm:text-lg font-semibold leading-tight tracking-tight truncate">SUP Juff</h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Suprimentos</p>
            </div>
          </div>
          <div className="flex justify-center">
            <MacroSwitch active="sup" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/configuracoes", search: { area: "sup" } as any })} aria-label="Configurações">
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

      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 sm:py-6 bg-teal-50/60 rounded-b-xl">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap mb-6">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="fornecedores" forceMount hidden={tab !== "fornecedores"}>
            <FornecedoresTab />
          </TabsContent>
          <TabsContent value="produtos" forceMount hidden={tab !== "produtos"}>
            <ProdutosTab />
          </TabsContent>
          <TabsContent value="pedidos" forceMount hidden={tab !== "pedidos"}>
            <PedidosCompraTab pcId={search.pcId} fornecedorId={search.fornecedorId} />
          </TabsContent>
          <TabsContent value="comissoes" forceMount hidden={tab !== "comissoes"}>
            <ComissoesTab />
          </TabsContent>
          <TabsContent value="dashboard" forceMount hidden={tab !== "dashboard"}>
            <DashboardSupTab />
          </TabsContent>
          {isAdmin && (
            <>
              <TabsContent value="alteracoes-preco" forceMount hidden={tab !== "alteracoes-preco"}>
                <AlteracoesPrecoTab />
              </TabsContent>
              <TabsContent value="config" forceMount hidden={tab !== "config"}>
                <SupConfigTab />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  );
}
