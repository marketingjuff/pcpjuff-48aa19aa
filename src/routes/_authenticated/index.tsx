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
import { useIsAdmin, useMyRoles } from "@/hooks/use-role";
import type { AppArea } from "@/integrations/supabase/schema-extras";
import type { Pedido } from "@/lib/pedidos";
import { DadosInTab } from "@/components/pcp/DadosInTab";
import { ArteTab } from "@/components/pcp/ArteTab";
import { DTFTab } from "@/components/pcp/DTFTab";
import { SilkTab } from "@/components/pcp/SilkTab";
import { AcabamentoTab } from "@/components/pcp/AcabamentoTab";
import { DashboardTab } from "@/components/pcp/DashboardTab";
import { FinalizadosTab } from "@/components/pcp/FinalizadosTab";
import { ExpedicaoTab } from "@/components/pcp/ExpedicaoTab";
import { DirtyFormProvider } from "@/components/pcp/dirty-form-context";

export const Route = createFileRoute("/_authenticated/")({
  component: AppHome,
});

function AppHome() {
  return (
    <DirtyFormProvider>
      <AppHomeInner />
    </DirtyFormProvider>
  );
}

function AppHomeInner() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isAdmin = useIsAdmin();
  const { data: myRoles = [] } = useMyRoles();
  const isGestor = myRoles.some((r) => r.role === "gestor");
  const areas = new Set<AppArea>(
    (myRoles.flatMap((r) => (r.areas_extras ?? []) as AppArea[])),
  );
  const canSee = (a: AppArea) => isAdmin || areas.has(a);
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

  type TabDef = { value: string; label: string };
  const tabs: TabDef[] = [
    ...(isManager ? [{ value: "dashboard", label: "Dashboard Master" }] : []),
    ...((canSee("dados_in_vendedor") || canSee("dados_in_producao")) ? [{ value: "dados", label: "Dados In" }] : []),
    ...(canSee("arte") ? [{ value: "arte", label: "Arte" }] : []),
    ...(canSee("dtf") ? [{ value: "dtf", label: "DTF" }] : []),
    ...(canSee("silk") ? [{ value: "silk", label: "Silk Screen" }] : []),
    ...(canSee("acabamento") ? [{ value: "acab", label: "Acabamento" }] : []),
    ...(canSee("expedicao") ? [{ value: "exp", label: "Expedição" }] : []),
    ...(isManager ? [{ value: "fin", label: "Finalizados" }] : []),
  ];
  const activeTabLabel = tabs.find((t) => t.value === tab)?.label ?? "";

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
          <div />
          <div className="flex items-center gap-1 sm:gap-2">
            {isManager && (
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/configuracoes" })} aria-label="Configurações">
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


      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="hidden md:flex flex-wrap mb-6">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {isManager && (
            <TabsContent value="dashboard" forceMount hidden={tab !== "dashboard"}>
              <DashboardTab pedidos={pedidos} loading={isLoading} onEdit={(id) => goToTabWithPedido("dados", id)} onViewProgress={(id) => goToTabWithPedido("arte", id)} />
            </TabsContent>
          )}
          {(canSee("dados_in_vendedor") || canSee("dados_in_producao")) && (
            <TabsContent value="dados" forceMount hidden={tab !== "dados"}>
              <DadosInTab active={tab === "dados"} pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} onDelete={(id) => remove.mutate(id)} saving={upsert.isPending} />
            </TabsContent>
          )}
          {canSee("arte") && (
            <TabsContent value="arte" forceMount hidden={tab !== "arte"}>
              <ArteTab active={tab === "arte"} pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} />
            </TabsContent>
          )}
          {canSee("dtf") && (
            <TabsContent value="dtf" forceMount hidden={tab !== "dtf"}>
              <DTFTab active={tab === "dtf"} pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} onNavigate={setTab} />
            </TabsContent>
          )}
          {canSee("silk") && (
            <TabsContent value="silk" forceMount hidden={tab !== "silk"}>
              <SilkTab active={tab === "silk"} pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} onNavigate={setTab} />
            </TabsContent>
          )}
          {canSee("acabamento") && (
            <TabsContent value="acab" forceMount hidden={tab !== "acab"}>
              <AcabamentoTab active={tab === "acab"} pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} onNavigate={setTab} />
            </TabsContent>
          )}

          {canSee("expedicao") && (
            <TabsContent value="exp" forceMount hidden={tab !== "exp"}>
              <ExpedicaoTab pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} onNavigate={setTab} />
            </TabsContent>
          )}
          {isManager && (
            <TabsContent value="fin" forceMount hidden={tab !== "fin"}>
              <FinalizadosTab pedidos={pedidos} onReabrir={(id) => upsert.mutate({ id, finalizado_em: null, reaberto: true })} />
            </TabsContent>
          )}

        </Tabs>
      </main>
    </div>
  );
}
