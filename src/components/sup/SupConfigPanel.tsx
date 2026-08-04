import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAdmin } from "@/hooks/use-role";
import { FornecedoresTab } from "@/components/sup/FornecedoresTab";
import { SupConfigTab } from "@/components/sup/SupConfigTab";

export function SupConfigPanel() {
  const isAdmin = useIsAdmin();
  return (
    <Tabs defaultValue="fornecedores">
      <TabsList className="mb-6 flex flex-wrap h-auto w-full sm:w-auto">
        <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
        {isAdmin && <TabsTrigger value="regras">Regras e comissionados</TabsTrigger>}
      </TabsList>
      <TabsContent value="fornecedores"><FornecedoresTab /></TabsContent>
      {isAdmin && <TabsContent value="regras"><SupConfigTab /></TabsContent>}
    </Tabs>
  );
}
