import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type SupFornecedor } from "@/lib/sup";

export function useSupFornecedores() {
  return useQuery({
    queryKey: ["sup-fornecedores"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sup_fornecedores")
        .select("*")
        .order("razao_social");
      if (error) throw error;
      return (data ?? []) as SupFornecedor[];
    },
  });
}
