import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Factory, LogOut, Settings } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-role";
import type { Pedido } from "@/lib/pedidos";
import { DadosInTab } from "@/components/pcp/DadosInTab";
import { ArteTab } from "@/components/pcp/ArteTab";
import { DTFTab } from "@/components/pcp/DTFTab";
import { SilkTab } from "@/components/pcp/SilkTab";
import { AcabamentoTab } from "@/components/pcp/AcabamentoTab";
import { DashboardTab } from "@/components/pcp/DashboardTab";
import { FinalizadosTab } from "@/components/pcp/FinalizadosTab";
import { DirtyFormProvider, useDirtyForm } from "@/components/pcp/dirty-form-context";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isAdmin = useIsAdmin();
  const { isDirty, setDirty, triggerSave } = useDirtyForm();
  const [pendingNav, setPendingNav] = useState<null | { kind: "tab"; value: string } | { kind: "logout" } | { kind: "settings" }>(null);

  function requestTab(next: string) {
    if (next === tab) return;
    if (isDirty) setPendingNav({ kind: "tab", value: next });
    else setTab(next);
  }
  function requestLogout() {
    if (isDirty) setPendingNav({ kind: "logout" });
    else handleLogout();
  }
  function requestSettings() {
    if (isDirty) { setPendingNav({ kind: "settings" }); return false; }
    return true;
  }

  async function performPending(save: boolean) {
    const p = pendingNav;
    setPendingNav(null);
    if (save) { try { await triggerSave(); } catch { /* fica na aba */ return; } }
    setDirty(false);
    if (!p) return;
    if (p.kind === "tab") setTab(p.value);
    else if (p.kind === "logout") handleLogout();
    else if (p.kind === "settings") navigate({ to: "/configuracoes" });
  }


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
    if (isDirty) setPendingNav({ kind: "tab", value: t });
    else setTab(t);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">PCP Juff</h1>
              <p className="text-xs text-muted-foreground">Controle de produção</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/configuracoes">
                <Button variant="ghost" size="sm"><Settings className="h-4 w-4 mr-1" /> Configurações</Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-7 mb-6">
            <TabsTrigger value="dashboard">Dashboard Master</TabsTrigger>
            <TabsTrigger value="dados">Dados In</TabsTrigger>
            <TabsTrigger value="arte">Arte</TabsTrigger>
            <TabsTrigger value="dtf">DTF</TabsTrigger>
            <TabsTrigger value="silk">Silk Screen</TabsTrigger>
            <TabsTrigger value="acab">Acabamento</TabsTrigger>
            <TabsTrigger value="fin">Finalizados</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" forceMount hidden={tab !== "dashboard"}>
            <DashboardTab pedidos={pedidos} loading={isLoading} onEdit={(id) => goToTabWithPedido("dados", id)} onViewProgress={(id) => goToTabWithPedido("arte", id)} />
          </TabsContent>
          <TabsContent value="dados" forceMount hidden={tab !== "dados"}>
            <DadosInTab pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} onDelete={(id) => remove.mutate(id)} saving={upsert.isPending} />
          </TabsContent>
          <TabsContent value="arte" forceMount hidden={tab !== "arte"}>
            <ArteTab pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} />
          </TabsContent>
          <TabsContent value="dtf" forceMount hidden={tab !== "dtf"}>
            <DTFTab pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} />
          </TabsContent>
          <TabsContent value="silk" forceMount hidden={tab !== "silk"}>
            <SilkTab pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} />
          </TabsContent>
          <TabsContent value="acab" forceMount hidden={tab !== "acab"}>
            <AcabamentoTab pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} />
          </TabsContent>
          <TabsContent value="fin" forceMount hidden={tab !== "fin"}>
            <FinalizadosTab pedidos={pedidos} onReabrir={(id) => upsert.mutate({ id, finalizado_em: null })} />
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}
