import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, Menu } from "lucide-react";
import logoJuff from "@/assets/logo-juff.jpg.asset.json";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useIsAdmin, useMyRoles, useMinhasPermissoes, useAbasPermitidas, useNiveisPermissoes } from "@/hooks/use-role";
import { rotaInicial, type PermissaoKey } from "@/lib/permissoes";

import type { Pedido } from "@/lib/pedidos";
import { DadosInTab } from "@/components/pcp/DadosInTab";
import { ArteTab } from "@/components/pcp/ArteTab";
import { DTFTab } from "@/components/pcp/DTFTab";
import { SilkTab } from "@/components/pcp/SilkTab";
import { AcabamentoTab } from "@/components/pcp/AcabamentoTab";
import { DashboardTab } from "@/components/pcp/DashboardTab";
import { MonitorPcpTab } from "@/components/pcp/monitor/MonitorPcpTab";
import { FinalizadosTab } from "@/components/pcp/FinalizadosTab";
import { ExpedicaoTab } from "@/components/pcp/ExpedicaoTab";
import { FreteTab } from "@/components/pcp/FreteTab";
import { RetrabalhoTab } from "@/components/pcp/RetrabalhoTab";
import { HistoricoTab } from "@/components/pcp/HistoricoTab";
import { DirtyFormProvider } from "@/components/pcp/dirty-form-context";
import { fecharEpisodiosResolvidos } from "@/lib/pedidos";
import { MacroSwitch } from "@/routes/_authenticated/cop";

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
    pedidoId: typeof s.pedidoId === "string" ? s.pedidoId : undefined,
  }) as { tab?: string; pedidoId?: string },
  component: AppHome,
});

function AppHome() {
  return (
    <DirtyFormProvider>
      <AppHomeInner />
    </DirtyFormProvider>
  );
}

/** Abas que saíram do PCP e agora vivem no módulo KPI. */
const KPI_REDIRECT: Record<string, string> = {
  indicadores: "custom",
  indicadores_store: "store",
  importolist: "importolist",
};

function AppHomeInner() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [tab, setTab] = useState(search.tab ?? "dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(search.pedidoId ?? null);

  // Links e a última aba salva podem apontar para as abas migradas para /kpi.
  const kpiAlvo =
    KPI_REDIRECT[search.tab ?? ""] ??
    (typeof window !== "undefined" ? KPI_REDIRECT[window.localStorage.getItem("pcp:tab") ?? ""] : undefined);
  useEffect(() => {
    if (!kpiAlvo) return;
    if (typeof window !== "undefined") window.localStorage.removeItem("pcp:tab");
    navigate({ to: "/kpi", search: { tab: kpiAlvo } as any, replace: true });
  }, [kpiAlvo, navigate]);

  useEffect(() => {
    if (search.tab && !KPI_REDIRECT[search.tab]) setTab(search.tab);
    if (search.pedidoId) setSelectedId(search.pedidoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.tab, search.pedidoId]);

  const isAdmin = useIsAdmin();
  const { data: myRoles = [], isLoading: rolesLoading } = useMyRoles();
  const isGestor = myRoles.some((r) => r.role === "gestor");
  const permissoes = useMinhasPermissoes();
  const pode = (k: PermissaoKey) => permissoes.has(k);
  const abasPcp = useAbasPermitidas("pcp");
  const niveis = useNiveisPermissoes();
  const soLeitura = (k: PermissaoKey) => niveis.get(k) === "leitura";
  const isManager = isAdmin || isGestor;


  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .order("entrada_pedido", { ascending: false });
      if (error) throw error;
      return data as unknown as Pedido[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("pedidos-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => {
        qc.invalidateQueries({ queryKey: ["pedidos"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Pedido> & { id?: string }) => {
      const row = { ...payload } as any;
      if (row.id) {
        const { error } = await supabase.from("pedidos").update(row).eq("id", row.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("pedidos").insert(row).select().single();
        if (error) throw error;
        setSelectedId(data.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success("Salvo.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pedidos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      setSelectedId(null);
      toast.success("Pedido removido.");
    },
  });

  const selected = useMemo(
    () => pedidos.find((p) => p.id === selectedId) ?? null,
    [pedidos, selectedId],
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth", replace: true });
  }

  function goToTabWithPedido(t: string, id: string) {
    setSelectedId(id);
    setTab(t);
  }

  // Auto-scroll para o topo quando um pedido é selecionado (aplica em todas as abas)
  useEffect(() => {
    if (!selectedId) return;
    if (typeof window === "undefined") return;
    // pequeno delay para garantir que a aba mudou e o card renderizou
    const id = window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [selectedId, tab]);

  // Auto-fecha episódios cuja etapa de origem foi recuperada.
  useEffect(() => {
    pedidos.forEach((p) => {
      const novo = fecharEpisodiosResolvidos(p);
      if (novo) upsert.mutate({ id: p.id, refacoes: novo } as any);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos]);

  type TabDef = { value: string; label: string };
  const tabs: TabDef[] = [];
  const vistos = new Set<string>();
  for (const a of abasPcp) {
    if (vistos.has(a.tabValue)) continue;
    vistos.add(a.tabValue);
    tabs.push({ value: a.tabValue, label: a.tabValue === "dados" ? "Dados In" : a.label });
  }
  if (isAdmin) tabs.push({ value: "historico", label: "Histórico PCP" });
  const activeTabLabel = tabs.find((t) => t.value === tab)?.label ?? "";

  // Aba inválida (URL ou localStorage) cai na primeira aba permitida.
  const primeiraAba = tabs[0]?.value;
  useEffect(() => {
    if (rolesLoading || !primeiraAba) return;
    if (!tabs.some((t) => t.value === tab)) setTab(primeiraAba);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesLoading, primeiraAba, tab]);

  // Sem nenhuma aba de PCP: manda para o primeiro módulo permitido.
  const destino = rotaInicial(permissoes, isAdmin);
  useEffect(() => {
    if (rolesLoading || kpiAlvo) return;
    if (tabs.length === 0 && destino !== "/") navigate({ to: destino as any, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesLoading, tabs.length, destino, kpiAlvo]);

  if (!rolesLoading && !isAdmin && permissoes.size === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="font-display text-lg font-semibold">Sem permissões atribuídas</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta ainda não tem acesso a nenhuma área do sistema. Fale com o administrador.
          </p>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  function pickTab(v: string) {
    setTab(v);
    setMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="max-w-[1600px] mx-auto grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="flex items-center gap-2">
                    <img src={logoJuff.url} alt="Logo Juff" className="h-8 w-8 rounded-lg object-cover" />
                    PCP Juff
                  </SheetTitle>
                </SheetHeader>
                <nav className="p-2 flex flex-col">
                  {tabs.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => pickTab(t.value)}
                      className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${tab === t.value ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            <img
              src={logoJuff.url}
              alt="Logo Juff"
              className="hidden sm:block h-10 w-10 rounded-xl object-cover ring-1 ring-primary/15 shrink-0"
            />
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-semibold leading-tight tracking-tight truncate">PCP Juff</h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                <span className="md:hidden">{activeTabLabel}</span>
                <span className="hidden md:inline">Controle de produção</span>
              </p>
            </div>
          </div>
          <div className="flex justify-center"><MacroSwitch active="pcp" /></div>
          <div className="flex items-center gap-1 sm:gap-2">
            {isManager && (
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/configuracoes", search: { origem: "/" } as any })} aria-label="Configurações">
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


      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 sm:py-6 bg-blue-50/60 rounded-b-xl">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="hidden md:flex flex-wrap mb-6">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {pode("pcp.dashboard") && (
            <TabsContent value="dashboard" forceMount hidden={tab !== "dashboard"}>
              <DashboardTab pedidos={pedidos} loading={isLoading} onEdit={(id) => goToTabWithPedido("dados", id)} onViewProgress={(id) => goToTabWithPedido("arte", id)} />
            </TabsContent>
          )}
          {pode("pcp.monitor") && (
            <TabsContent value="monitor" forceMount hidden={tab !== "monitor"}>
              <MonitorPcpTab
                pedidos={pedidos}
                onSave={(p) => upsert.mutate(p)}
                onNavigate={(t, id) => goToTabWithPedido(t, id)}
                soLeitura={soLeitura("pcp.monitor")}
              />
            </TabsContent>
          )}
          {(pode("pcp.dados_in_vendedor") || pode("pcp.dados_in_producao")) && (
            <TabsContent value="dados" forceMount hidden={tab !== "dados"}>
              <DadosInTab active={tab === "dados"} pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} onDelete={(id) => remove.mutate(id)} saving={upsert.isPending} soLeituraVendedor={!pode("pcp.dados_in_vendedor") || soLeitura("pcp.dados_in_vendedor")} soLeituraProducao={!pode("pcp.dados_in_producao") || soLeitura("pcp.dados_in_producao")} />
            </TabsContent>
          )}
          {pode("pcp.arte") && (
            <TabsContent value="arte" forceMount hidden={tab !== "arte"}>
              <ArteTab active={tab === "arte"} pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} canManage={isManager} soLeitura={soLeitura("pcp.arte")} />
            </TabsContent>
          )}
          {pode("pcp.dtf") && (
            <TabsContent value="dtf" forceMount hidden={tab !== "dtf"}>
              <DTFTab active={tab === "dtf"} pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} onNavigate={setTab} canManage={isManager} soLeitura={soLeitura("pcp.dtf")} />
            </TabsContent>
          )}
          {pode("pcp.silk") && (
            <TabsContent value="silk" forceMount hidden={tab !== "silk"}>
              <SilkTab active={tab === "silk"} pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} onNavigate={setTab} canManage={isManager} soLeitura={soLeitura("pcp.silk")} />
            </TabsContent>
          )}
          {pode("pcp.acabamento") && (
            <TabsContent value="acab" forceMount hidden={tab !== "acab"}>
              <AcabamentoTab active={tab === "acab"} pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} onNavigate={setTab} canManage={isManager} soLeitura={soLeitura("pcp.acabamento")} />
            </TabsContent>
          )}

          {pode("pcp.expedicao") && (
            <TabsContent value="exp" forceMount hidden={tab !== "exp"}>
              <ExpedicaoTab
                pedidos={pedidos}
                selected={selected}
                onSelect={setSelectedId}
                onSave={(p) => upsert.mutate(p)}
                saving={upsert.isPending}
                onNavigate={setTab}
                soLeitura={soLeitura("pcp.expedicao")}
                podeForcarFinalizacao={isAdmin || (isGestor && pode("pcp.expedicao"))}
                onFinalizarMany={(ids) => {
                  const now = new Date().toISOString();
                  ids.forEach((id) => upsert.mutate({ id, finalizado_em: now, reaberto: false }));
                }}
              />
            </TabsContent>
          )}
          {pode("pcp.frete") && (
            <TabsContent value="frete" forceMount hidden={tab !== "frete"}>
              <FreteTab
                pedidos={pedidos}
                onSave={(p: Partial<Pedido> & { id?: string }) => upsert.mutate(p)}
                saving={upsert.isPending}
                soLeitura={soLeitura("pcp.frete")}
              />
            </TabsContent>
          )}
          {pode("pcp.finalizados") && (

            <TabsContent value="fin" forceMount hidden={tab !== "fin"}>
              <FinalizadosTab
                pedidos={pedidos}
                onReabrir={(id) => upsert.mutate({ id, finalizado_em: null, reaberto: true })}
                canReabrir={isAdmin || (isGestor && pode("pcp.expedicao"))}
                soLeitura={soLeitura("pcp.finalizados")}
              />
            </TabsContent>
          )}
          {pode("pcp.retrabalho") && (
            <TabsContent value="retrab" forceMount hidden={tab !== "retrab"}>
              <RetrabalhoTab pedidos={pedidos} onSave={(p) => upsert.mutate(p)} soLeitura={soLeitura("pcp.retrabalho")} />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="historico" forceMount hidden={tab !== "historico"}>
              <HistoricoTab />
            </TabsContent>
          )}



        </Tabs>
      </main>
    </div>
  );
}
