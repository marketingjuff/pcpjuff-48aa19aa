import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";
import logoJuff from "@/assets/logo-juff.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useMyRoles, useCanAccessCop, useCanAccessMap, useCanAccessSup, useCanAccessKpi, useIsAdmin, useAbasPermitidas, useMinhasPermissoes } from "@/hooks/use-role";
import { rotaInicial } from "@/lib/permissoes";
import { CorteTab } from "@/components/cop/CorteTab";
import { RomaneioTab } from "@/components/cop/RomaneioTab";
import { DisponivelTab } from "@/components/cop/DisponivelTab";
import { FaltaPorPedidoTab } from "@/components/cop/FaltaPorPedidoTab";
import { PagamentoOficinasTab } from "@/components/cop/PagamentoOficinasTab";
import { PerdasTab } from "@/components/cop/PerdasTab";
import { DashboardCopTab } from "@/components/cop/DashboardCopTab";
import { OficinasHojeTab } from "@/components/cop/OficinasHojeTab";
import { HistoricoCopTab } from "@/components/cop/HistoricoCopTab";
import { ControlePerdasTab } from "@/components/cop/ControlePerdasTab";
import { AlimentacaoEstoqueTab } from "@/components/cop/AlimentacaoEstoqueTab";
import { SaldoRealTab } from "@/components/cop/SaldoRealTab";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cop")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
    copId: typeof s.copId === "string" ? s.copId : undefined,
    area: typeof s.area === "string" ? s.area : undefined,
  }) as { tab?: string; copId?: string; area?: string },
  component: CopHome,
});


function CopHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canAccess = useCanAccessCop();
  const isAdmin = useIsAdmin();
  const { data: myRoles = [], isLoading } = useMyRoles();
  const isGestor = myRoles.some((r) => r.role === "gestor");
  const abas = useAbasPermitidas("cop");
  const permissoes = useMinhasPermissoes();
  const pode = (k: string) => permissoes.has(k);
  const TABS = [
    ...abas.map((a) => ({ value: a.tabValue, label: a.label })),
    ...(isAdmin ? [{ value: "historico", label: "Histórico COP" }] : []),
  ];
  const search = Route.useSearch();
  const [tab, setTabState] = useState(() => {
    if (search.tab) return search.tab;
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("cop:tab");
      if (saved) return saved;
    }
    return "corte";
  });
  const setTab = (t: string) => {
    setTabState(t);
    if (typeof window !== "undefined") window.localStorage.setItem("cop:tab", t);
  };
  const [copSelId, setCopSelId] = useState<string | null>(search.copId ?? null);

  useEffect(() => {
    if (search.tab) setTabState(search.tab);
    if (search.copId) setCopSelId(search.copId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.tab, search.copId]);

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

  // Aplica o escopo do COP também no <body>, para diálogos renderizados em portal.
  useEffect(() => {
    document.body.classList.add("cop-scope");
    return () => document.body.classList.remove("cop-scope");
  }, []);


  async function handleLogout() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading || !canAccess) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="min-h-screen bg-background cop-scope">

      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="max-w-[1600px] mx-auto grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={logoJuff.url} alt="Logo Juff" className="hidden sm:block h-10 w-10 rounded-xl object-cover ring-1 ring-primary/15 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-semibold leading-tight tracking-tight truncate">COP Juff</h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Controle de Ordem de Produção</p>
            </div>
          </div>
          <div className="flex justify-center">
            <MacroSwitch active="cop" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {(isAdmin || isGestor) && (
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/configuracoes", search: { area: "cop" } as any })} aria-label="Configurações">
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

      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 sm:py-6 bg-green-50/60 rounded-b-xl">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap mb-6">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {pode("cop.corte") && (
          <TabsContent value="corte" forceMount hidden={tab !== "corte"}>
            <CorteTab selectedId={copSelId} onSelect={setCopSelId} onChangeTab={setTab} />
          </TabsContent>
          )}
          {pode("cop.romaneio") && (
          <TabsContent value="romaneio" forceMount hidden={tab !== "romaneio"}>
            <RomaneioTab selectedId={copSelId} onSelect={setCopSelId} onChangeTab={setTab} />
          </TabsContent>
          )}
          {pode("cop.dashboard") && (
          <TabsContent value="dashboard" forceMount hidden={tab !== "dashboard"}>
            <DashboardCopTab />
          </TabsContent>
          )}
          {pode("cop.disponivel") && (
          <TabsContent value="disponivel" forceMount hidden={tab !== "disponivel"}>
            <DisponivelTab />
          </TabsContent>
          )}
          {pode("cop.alimentacao_estoque") && (
          <TabsContent value="alimentacao-estoque" forceMount hidden={tab !== "alimentacao-estoque"}>
            <AlimentacaoEstoqueTab />
          </TabsContent>
          )}
          {pode("cop.saldo_real") && (
          <TabsContent value="saldo-real" forceMount hidden={tab !== "saldo-real"}>
            <SaldoRealTab />
          </TabsContent>
          )}

          {pode("cop.falta") && (
          <TabsContent value="falta" forceMount hidden={tab !== "falta"}>
            <FaltaPorPedidoTab />
          </TabsContent>
          )}
          {pode("cop.oficinas_hoje") && (
          <TabsContent value="oficinas-hoje" forceMount hidden={tab !== "oficinas-hoje"}>
            <OficinasHojeTab />
          </TabsContent>
          )}
          {pode("cop.pagamento") && (
          <TabsContent value="pagamento" forceMount hidden={tab !== "pagamento"}>
            <PagamentoOficinasTab selectedId={copSelId} onSelect={setCopSelId} onChangeTab={setTab} />
          </TabsContent>
          )}
          {pode("cop.perdas") && (
          <TabsContent value="perdas" forceMount hidden={tab !== "perdas"}>
            <PerdasTab />
          </TabsContent>
          )}
          {pode("cop.controle_perdas") && (
          <TabsContent value="controle-perdas" forceMount hidden={tab !== "controle-perdas"}>
            <ControlePerdasTab />
          </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="historico" forceMount hidden={tab !== "historico"}>
              <HistoricoCopTab />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

export function MacroSwitch({ active }: { active: "pcp" | "cop" | "map" | "sup" | "kpi" }) {
  const navigate = useNavigate();
  const canAccessCop = useCanAccessCop();
  const canAccessMap = useCanAccessMap();
  const canAccessSup = useCanAccessSup();
  const canAccessKpi = useCanAccessKpi();
  const isAdminMacro = useIsAdmin();
  const abasPcpMacro = useAbasPermitidas("pcp");
  const canAccessPcp = isAdminMacro || abasPcpMacro.length > 0;
  const totalModulos = [canAccessPcp, canAccessCop, canAccessMap, canAccessSup, canAccessKpi].filter(Boolean).length;
  if (totalModulos <= 1) return null;
  const baseBtn = "px-6 py-2 rounded font-bold text-base transition-colors";
  const pcpActive = active === "pcp"
    ? "bg-blue-600 text-white"
    : "hover:bg-accent text-foreground";
  const copActive = active === "cop"
    ? "bg-green-600 text-white"
    : "hover:bg-accent text-foreground";
  const mapActive = active === "map"
    ? "bg-yellow-500 text-white"
    : "hover:bg-accent text-foreground";
  const supActive = active === "sup"
    ? "bg-teal-500 text-white"
    : "hover:bg-accent text-foreground";
  const kpiActive = active === "kpi"
    ? "bg-purple-600 text-white"
    : "hover:bg-accent text-foreground";
  return (
    <div className="inline-flex rounded-md border bg-card p-1">
      {canAccessPcp && (
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className={`${baseBtn} ${pcpActive}`}
        >
          PCP
        </button>
      )}
      {canAccessCop && (
        <button
          type="button"
          onClick={() => navigate({ to: "/cop" })}
          className={`${baseBtn} ${copActive}`}
        >
          COP
        </button>
      )}
      {canAccessMap && (
        <button
          type="button"
          onClick={() => navigate({ to: "/map" })}
          className={`${baseBtn} ${mapActive}`}
        >
          MAP
        </button>
      )}
      {canAccessSup && (
        <button
          type="button"
          onClick={() => navigate({ to: "/sup" })}
          className={`${baseBtn} ${supActive}`}
        >
          SUP
        </button>
      )}
      {canAccessKpi && (
        <button
          type="button"
          onClick={() => navigate({ to: "/kpi" })}
          className={`${baseBtn} ${kpiActive}`}
        >
          KPI
        </button>
      )}
    </div>
  );
}
