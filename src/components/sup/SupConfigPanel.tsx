import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAdmin } from "@/hooks/use-role";
import { DepartamentosTab } from "@/components/sup/DepartamentosTab";
import { SupConfigTab } from "@/components/sup/SupConfigTab";

export function SupConfigPanel() {
  const isAdmin = useIsAdmin();
  return (
    <Tabs defaultValue="departamentos">
      <TabsList className="mb-6 flex flex-wrap h-auto w-full sm:w-auto">
        <TabsTrigger value="departamentos">Departamentos</TabsTrigger>
        {isAdmin && <TabsTrigger value="regras">Regras e comissionados</TabsTrigger>}
      </TabsList>
      <TabsContent value="departamentos"><DepartamentosTab /></TabsContent>
      {isAdmin && <TabsContent value="regras"><SupConfigTab /></TabsContent>}
    </Tabs>
  );
}
