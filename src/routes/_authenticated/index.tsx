import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Factory, LogOut } from "lucide-react";
import { toast } from "sonner";
import type { Pedido } from "@/lib/pedidos";
import { DadosInTab } from "@/components/pcp/DadosInTab";
import { ArteTab } from "@/components/pcp/ArteTab";
import { DTFTab } from "@/components/pcp/DTFTab";
import { SilkTab } from "@/components/pcp/SilkTab";
import { AcabamentoTab } from "@/components/pcp/AcabamentoTab";
import { DashboardTab } from "@/components/pcp/DashboardTab";
import { FinalizadosTab } from "@/components/pcp/FinalizadosTab";

export const Route = createFileRoute("/_authenticated/")({
  component: AppHome,
});

function AppHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .order("entrada_pedido", { ascending: false });
      if (error) throw error;
      return data as Pedido[];
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
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const row = { ...payload, user_id: u.user.id } as any;
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
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-7 mb-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="dados">Dados In</TabsTrigger>
            <TabsTrigger value="arte">Arte</TabsTrigger>
            <TabsTrigger value="dtf">DTF</TabsTrigger>
            <TabsTrigger value="silk">Silk Screen</TabsTrigger>
            <TabsTrigger value="acab">Acabamento</TabsTrigger>
            <TabsTrigger value="fin">Finalizados</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab pedidos={pedidos} loading={isLoading} onEdit={(id) => goToTabWithPedido("dados", id)} onViewProgress={(id) => goToTabWithPedido("arte", id)} />
          </TabsContent>
          <TabsContent value="dados">
            <DadosInTab pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} onDelete={(id) => remove.mutate(id)} saving={upsert.isPending} />
          </TabsContent>
          <TabsContent value="arte">
            <ArteTab pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} />
          </TabsContent>
          <TabsContent value="dtf">
            <DTFTab pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} />
          </TabsContent>
          <TabsContent value="silk">
            <SilkTab pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} />
          </TabsContent>
          <TabsContent value="acab">
            <AcabamentoTab pedidos={pedidos} selected={selected} onSelect={setSelectedId} onSave={(p) => upsert.mutate(p)} saving={upsert.isPending} />
          </TabsContent>
          <TabsContent value="fin">
            <FinalizadosTab pedidos={pedidos} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
