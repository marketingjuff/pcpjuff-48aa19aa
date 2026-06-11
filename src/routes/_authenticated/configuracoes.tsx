import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { formatDateBR } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useMyRoles } from "@/hooks/use-role";
import {
  createUserAccount,
  listUsers,
  updateUserRole,
  deleteUserAccount,
} from "@/lib/admin.functions";
import type { AppRole, Feriado } from "@/integrations/supabase/schema-extras";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesPage,
});

const ROLES: AppRole[] = ["admin", "gestor", "arte", "dtf", "silk", "acabamento"];

function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { data: roles = [], isLoading } = useMyRoles();
  const isAdmin = roles.some((r) => r.role === "admin");

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      toast.error("Acesso restrito a administradores.");
      navigate({ to: "/" });
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading || !isAdmin) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
            <h1 className="text-lg font-semibold">Configurações</h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="feriados">
          <TabsList className="mb-6">
            <TabsTrigger value="feriados">Feriados</TabsTrigger>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          </TabsList>
          <TabsContent value="feriados"><FeriadosTab /></TabsContent>
          <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function FeriadosTab() {
  const qc = useQueryClient();
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data: feriados = [], isLoading } = useQuery({
    queryKey: ["feriados"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("feriados").select("*").order("data");
      if (error) throw error;
      return (data ?? []) as Feriado[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("Informe a data");
      const { error } = await (supabase as any).from("feriados").insert({ data, descricao: descricao || null });
      if (error) throw error;
    },
    onSuccess: () => {
      setData(""); setDescricao("");
      qc.invalidateQueries({ queryKey: ["feriados"] });
      toast.success("Feriado adicionado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("feriados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feriados"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex gap-2 items-end">
        <div>
          <Label>Data</Label>
          <DateInputBR value={data} onChange={(v) => setData(v ?? "")} />
        </div>
        <div className="flex-1">
          <Label>Descrição</Label>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Natal" />
        </div>
        <Button onClick={() => add.mutate()} disabled={add.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead></TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <TableRow><TableCell colSpan={3}>Carregando…</TableCell></TableRow>
            : feriados.length === 0 ? <TableRow><TableCell colSpan={3} className="text-muted-foreground">Nenhum feriado.</TableCell></TableRow>
            : feriados.map((f) => (
              <TableRow key={f.id}>
                <TableCell>{formatDateBR(f.data)}</TableCell>
                <TableCell>{f.descricao}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(f.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UsuariosTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const createFn = useServerFn(createUserAccount);
  const updateFn = useServerFn(updateUserRole);
  const deleteFn = useServerFn(deleteUserAccount);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<AppRole>("gestor");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: { email, password, nome, role } }),
    onSuccess: () => {
      setEmail(""); setPassword(""); setNome("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Usuário criado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (v: { userId: string; role: AppRole }) => updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Papel atualizado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Usuário removido.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Criar nova conta</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Senha inicial</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mín. 8 caracteres" /></div>
          <div>
            <Label>Área (papel)</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending || !email || !password}>
          <Plus className="h-4 w-4 mr-1" /> Criar usuário
        </Button>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Usuários cadastrados</h2>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Papel</TableHead><TableHead></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4}>Carregando…</TableCell></TableRow>
              : (users as any[]).map((u) => {
                const currentRole = (u.roles?.[0]?.role ?? "gestor") as AppRole;
                return (
                  <TableRow key={u.id}>
                    <TableCell>{u.nome ?? "—"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Select value={currentRole} onValueChange={(v) => update.mutate({ userId: u.id, role: v as AppRole })}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir este usuário?")) del.mutate(u.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
