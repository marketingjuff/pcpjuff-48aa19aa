import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";
import logoJuff from "@/assets/logo-juff.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useIsAdmin, useMyRoles } from "@/hooks/use-role";
import { CorteTab } from "@/components/cop/CorteTab";
import { CopEmConstrucao } from "@/components/cop/CopEmConstrucao";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cop")({
  component: CopHome,
});

const TABS = [
  { value: "dashboard", label: "Dashboard COP" },
  { value: "disponivel", label: "Disponível" },
  { value: "corte", label: "Corte" },
  { value: "romaneio", label: "Romaneio" },
  { value: "pagamento", label: "Pagamento Oficinas" },
  { value: "falta", label: "Falta por Pedido" },
  { value: "perdas", label: "Perdas" },
];

function CopHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const { isLoading } = useMyRoles();
  const [tab, setTab] = useState("corte");

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      toast.error("COP é restrito a administradores.");
      navigate({ to: "/", replace: true });
    }
  }, [isAdmin, isLoading, navigate]);

  async function handleLogout() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading || !isAdmin) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
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
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/configuracoes", search: { area: "cop" } as any })} aria-label="Configurações">
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

      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap mb-6">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="corte" forceMount hidden={tab !== "corte"}>
            <CorteTab />
          </TabsContent>
          {TABS.filter((t) => t.value !== "corte").map((t) => (
            <TabsContent key={t.value} value={t.value} forceMount hidden={tab !== t.value}>
              <CopEmConstrucao titulo={t.label} />
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}

export function MacroSwitch({ active }: { active: "pcp" | "cop" }) {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  return (
    <div className="inline-flex rounded-md border bg-card p-0.5 text-xs">
      <button
        type="button"
        onClick={() => navigate({ to: "/" })}
        className={`px-3 py-1 rounded font-medium transition-colors ${active === "pcp" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
      >
        PCP
      </button>
      {isAdmin && (
        <button
          type="button"
          onClick={() => navigate({ to: "/cop" })}
          className={`px-3 py-1 rounded font-medium transition-colors ${active === "cop" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
        >
          COP
        </button>
      )}
    </div>
  );
}
