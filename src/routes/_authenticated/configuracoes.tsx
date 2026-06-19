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
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Trash2, Plus, Download, Upload, KeyRound, ArrowUp, ArrowDown, ArrowDownAZ } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { toast } from "sonner";
import { useMyRoles } from "@/hooks/use-role";
import {
  createUserAccount,
  listUsers,
  updateUserRole,
  updateUserName,
  deleteUserAccount,
  adminUpdateUserPassword,
} from "@/lib/admin.functions";

import { exportBackup, importBackup } from "@/lib/backup.functions";
import { useAppList, useAppListMutations, type AppListKind } from "@/lib/app-lists";
import {
  anosSugeridos,
  fetchFeriadosNacionais,
  sugestoesCapitalSP,
  sugestoesEstadoSP,
  type Sugestao,
} from "@/lib/feriados-sugestoes";
import type { AppRole, AppArea, Feriado } from "@/integrations/supabase/schema-extras";
import { APP_AREAS_GESTOR, APP_AREAS_OPERADOR, APP_AREA_LABEL } from "@/integrations/supabase/schema-extras";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useColorSettings as useColorSettingsHook,
  DEFAULT_COLOR_SETTINGS as DEFAULT_COLOR_SETTINGS_CONST,
  ETAPAS_CONFIGURAVEIS as ETAPAS_CONFIGURAVEIS_CONST,
  type ColorSettings as ColorSettingsType,
  type BotaoKey as BotaoKeyType,
} from "@/hooks/use-color-settings";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesPage,
});

const ROLES: AppRole[] = ["admin", "gestor", "operador"];

function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { data: roles = [], isLoading } = useMyRoles();
  const isAdmin = roles.some((r) => r.role === "admin");
  const isGestor = roles.some((r) => r.role === "gestor");
  const canAccess = isAdmin || isGestor;

  useEffect(() => {
    if (!isLoading && !canAccess) {
      toast.error("Acesso restrito a administradores e gestores.");
      navigate({ to: "/" });
    }
  }, [canAccess, isLoading, navigate]);

  if (isLoading || !canAccess) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Voltar</span></Button></Link>
            <h1 className="text-base sm:text-lg font-semibold truncate">Configurações</h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Tabs defaultValue={isAdmin ? "feriados" : "listas"}>
          <TabsList className="mb-6 flex flex-wrap h-auto w-full sm:w-auto">
            {isAdmin && <TabsTrigger value="feriados">Feriados</TabsTrigger>}
            {isAdmin && <TabsTrigger value="usuarios">Usuários</TabsTrigger>}
            <TabsTrigger value="listas">Listas</TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
            {isAdmin && <TabsTrigger value="cores">Cores</TabsTrigger>}
          </TabsList>
          {isAdmin && <TabsContent value="feriados"><FeriadosTab /></TabsContent>}
          {isAdmin && <TabsContent value="usuarios"><UsuariosTab /></TabsContent>}
          <TabsContent value="listas"><ListasTab /></TabsContent>
          <TabsContent value="backup"><BackupTab /></TabsContent>
          {isAdmin && <TabsContent value="cores"><CoresTab /></TabsContent>}
        </Tabs>
      </main>
    </div>
  );
}

function FeriadosTab() {
  const qc = useQueryClient();
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");
  const anos = anosSugeridos();
  const [anoSel, setAnoSel] = useState<number>(anos[0]);

  const { data: feriados = [], isLoading } = useQuery({
    queryKey: ["feriados"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("feriados").select("*").order("data");
      if (error) throw error;
      return (data ?? []) as Feriado[];
    },
  });

  const datasCadastradas = new Set(feriados.map((f) => f.data));

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

  const addSugestao = useMutation({
    mutationFn: async (s: Sugestao) => {
      const { error } = await (supabase as any).from("feriados").insert({ data: s.data, descricao: s.descricao });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feriados"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const addLote = useMutation({
    mutationFn: async (lista: Sugestao[]) => {
      const pendentes = lista.filter((s) => !datasCadastradas.has(s.data));
      // Dedup por data dentro do próprio lote (ex.: Páscoa e Tiradentes em 21/04/2030).
      // Concatena descrições quando coincidir.
      const porData = new Map<string, string>();
      for (const s of pendentes) {
        const atual = porData.get(s.data);
        porData.set(s.data, atual ? `${atual} / ${s.descricao}` : s.descricao);
      }
      if (porData.size === 0) return 0;
      const rows = Array.from(porData, ([data, descricao]) => ({ data, descricao }));
      const { error } = await (supabase as any).from("feriados").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["feriados"] });
      if (n && n > 0) toast.success(`${n} feriado(s) adicionado(s).`);
      else toast.info("Nada para adicionar.");
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

  const nacionaisQ = useQuery({
    queryKey: ["sugestoes-nacionais", anoSel],
    queryFn: () => fetchFeriadosNacionais(anoSel),
    staleTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });

  const estadoSP = sugestoesEstadoSP(anoSel);
  const capitalSP = sugestoesCapitalSP(anoSel);

  return (
    <div className="space-y-6 max-w-3xl">
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

      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold">Sugestões de feriados</h2>
          <div className="flex gap-1">
            {anos.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={a === anoSel ? "default" : "outline"}
                onClick={() => setAnoSel(a)}
              >
                {a}
              </Button>
            ))}
          </div>
        </div>

        <SugestoesGrupo
          titulo="Nacionais"
          itens={nacionaisQ.data ?? []}
          loading={nacionaisQ.isLoading}
          erro={nacionaisQ.isError ? "Não foi possível carregar os feriados nacionais." : null}
          cadastradas={datasCadastradas}
          onAdd={(s) => addSugestao.mutate(s)}
          onAddAll={(lista) => addLote.mutate(lista)}
          busy={addSugestao.isPending || addLote.isPending}
        />
        <SugestoesGrupo
          titulo="Estado de São Paulo"
          itens={estadoSP}
          loading={false}
          erro={null}
          cadastradas={datasCadastradas}
          onAdd={(s) => addSugestao.mutate(s)}
          onAddAll={(lista) => addLote.mutate(lista)}
          busy={addSugestao.isPending || addLote.isPending}
        />
        <SugestoesGrupo
          titulo="Capital de São Paulo"
          itens={capitalSP}
          loading={false}
          erro={null}
          cadastradas={datasCadastradas}
          onAdd={(s) => addSugestao.mutate(s)}
          onAddAll={(lista) => addLote.mutate(lista)}
          busy={addSugestao.isPending || addLote.isPending}
        />
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

function SugestoesGrupo({
  titulo, itens, loading, erro, cadastradas, onAdd, onAddAll, busy,
}: {
  titulo: string;
  itens: Sugestao[];
  loading: boolean;
  erro: string | null;
  cadastradas: Set<string>;
  onAdd: (s: Sugestao) => void;
  onAddAll: (lista: Sugestao[]) => void;
  busy: boolean;
}) {
  const ordenadas = [...itens].sort((a, b) => a.data.localeCompare(b.data));
  const pendentes = ordenadas.filter((s) => !cadastradas.has(s.data));
  return (
    <div className="border rounded-md">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="text-sm font-medium">
          {titulo} <span className="text-muted-foreground">({pendentes.length} pendente{pendentes.length === 1 ? "" : "s"})</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || pendentes.length === 0}
          onClick={() => onAddAll(ordenadas)}
        >
          <Plus className="h-3 w-3 mr-1" /> Adicionar todos
        </Button>
      </div>
      <div className="divide-y">
        {loading ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">Carregando…</div>
        ) : erro ? (
          <div className="px-3 py-2 text-sm text-destructive">{erro}</div>
        ) : ordenadas.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma sugestão.</div>
        ) : ordenadas.map((s) => {
          const jaTem = cadastradas.has(s.data);
          return (
            <div key={s.data + s.descricao} className="px-3 py-1.5 flex items-center justify-between gap-3">
              <div className={"text-sm " + (jaTem ? "text-muted-foreground line-through" : "")}>
                <span className="tabular-nums">{formatDateBR(s.data)}</span> — {s.descricao}
              </div>
              {jaTem ? (
                <span className="text-xs text-muted-foreground">já adicionado</span>
              ) : (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAdd(s)}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function UsuariosTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const createFn = useServerFn(createUserAccount);
  const updateFn = useServerFn(updateUserRole);
  const renameFn = useServerFn(updateUserName);
  const deleteFn = useServerFn(deleteUserAccount);

  const passwordFn = useServerFn(adminUpdateUserPassword);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<AppRole>("gestor");
  const [areas, setAreas] = useState<AppArea[]>([]);
  const [editingName, setEditingName] = useState<{ id: string; nome: string } | null>(null);
  const [pwTarget, setPwTarget] = useState<{ id: string; email: string } | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");


  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: { email, password, nome, role, areas_extras: areas } }),
    onSuccess: () => {
      setEmail(""); setPassword(""); setNome(""); setAreas([]);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Usuário criado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (v: { userId: string; role: AppRole; areas_extras?: string[] }) => updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Papel atualizado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rename = useMutation({
    mutationFn: (v: { userId: string; nome: string }) => renameFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setEditingName(null);
      toast.success("Nome atualizado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const changePassword = useMutation({
    mutationFn: (v: { userId: string; password: string }) => passwordFn({ data: v }),
    onSuccess: () => {
      setPwTarget(null);
      setPwValue("");
      setPwConfirm("");
      toast.success("Senha atualizada.");
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
            <Label>Papel</Label>
            <Select value={role} onValueChange={(v) => { setRole(v as AppRole); setAreas([]); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {role !== "admin" && (
          <AreasCheckboxes
            value={areas}
            onChange={setAreas}
            options={role === "gestor" ? APP_AREAS_GESTOR : APP_AREAS_OPERADOR}
          />
        )}
        <Button onClick={() => create.mutate()} disabled={create.isPending || !email || !password}>
          <Plus className="h-4 w-4 mr-1" /> Criar usuário
        </Button>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Usuários cadastrados</h2>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Papel / Áreas</TableHead><TableHead></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4}>Carregando…</TableCell></TableRow>
              : (users as any[]).map((u) => {
                const currentRole = (u.roles?.[0]?.role ?? "operador") as AppRole;
                const currentAreas = ((u.roles?.[0]?.areas_extras ?? []) as string[]) as AppArea[];
                return (
                  <TableRow key={u.id}>
                    <TableCell className="align-top">
                      {editingName && editingName.id === u.id ? (
                        <div className="flex gap-1">
                          <Input
                            value={editingName.nome}
                            autoFocus
                            className="h-8"
                            onChange={(e) => setEditingName({ id: u.id, nome: e.target.value })}
                            onKeyDown={(e) => {
                              const nm = editingName?.nome.trim() ?? "";
                              if (e.key === "Enter") { e.preventDefault(); if (nm) rename.mutate({ userId: u.id, nome: nm }); }
                              if (e.key === "Escape") setEditingName(null);
                            }}
                          />
                          <Button size="sm" onClick={() => { const nm = editingName?.nome.trim() ?? ""; if (nm) rename.mutate({ userId: u.id, nome: nm }); }} disabled={rename.isPending}>Salvar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingName(null)}>Cancelar</Button>
                        </div>
                      ) : (
                        <button type="button" className="text-left hover:underline" onClick={() => setEditingName({ id: u.id, nome: u.nome ?? "" })}>
                          {u.nome ?? "—"}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="align-top">{u.email}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Select value={currentRole} onValueChange={(v) => update.mutate({ userId: u.id, role: v as AppRole, areas_extras: v === "admin" ? [] : currentAreas })}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {currentRole !== "admin" && (
                          <AreasCheckboxes
                            value={currentAreas}
                            onChange={(next) => update.mutate({ userId: u.id, role: currentRole, areas_extras: next })}
                            options={currentRole === "gestor" ? APP_AREAS_GESTOR : APP_AREAS_OPERADOR}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Trocar senha" onClick={() => { setPwTarget({ id: u.id, email: u.email }); setPwValue(""); setPwConfirm(""); }}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir este usuário?")) del.mutate(u.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!pwTarget} onOpenChange={(o) => { if (!o) setPwTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Usuário: <span className="font-medium text-foreground">{pwTarget?.email}</span></div>
            <div>
              <Label>Nova senha</Label>
              <Input type="text" value={pwValue} onChange={(e) => setPwValue(e.target.value)} placeholder="Mín. 8 caracteres" autoFocus />
            </div>
            <div>
              <Label>Confirmar nova senha</Label>
              <Input type="text" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
            </div>
            {pwValue.length > 0 && pwValue.length < 8 && (
              <div className="text-xs text-destructive">A senha deve ter ao menos 8 caracteres.</div>
            )}
            {pwConfirm.length > 0 && pwValue !== pwConfirm && (
              <div className="text-xs text-destructive">As senhas não conferem.</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwTarget(null)} disabled={changePassword.isPending}>Cancelar</Button>
            <Button
              onClick={() => pwTarget && changePassword.mutate({ userId: pwTarget.id, password: pwValue })}
              disabled={changePassword.isPending || pwValue.length < 8 || pwValue !== pwConfirm}
            >
              {changePassword.isPending ? "Salvando..." : "Trocar senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function AreasCheckboxes({ value, onChange, options }: { value: AppArea[]; onChange: (next: AppArea[]) => void; options: AppArea[] }) {
  function toggle(a: AppArea, checked: boolean) {
    const set = new Set(value);
    if (checked) set.add(a); else set.delete(a);
    onChange(options.filter((o) => set.has(o)));
  }
  return (
    <div className="grid grid-cols-2 gap-1.5 p-2 rounded-md border bg-muted/20">
      {options.map((a) => (
        <label key={a} className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox checked={value.includes(a)} onCheckedChange={(c) => toggle(a, !!c)} />
          <span>{APP_AREA_LABEL[a]}</span>
        </label>
      ))}
    </div>
  );
}

function BackupTab() {
  const exportFn = useServerFn(exportBackup);
  const importFn = useServerFn(importBackup);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const fileInputRef = useState<HTMLInputElement | null>(null);

  async function handleExport() {
    setExporting(true);
    setProgress(0);
    setSummary(null);
    setProgressLabel("Coletando dados do banco…");
    try {
      const JSZipMod = (await import("jszip")).default;
      const zip = new JSZipMod();

      const dados = await exportFn();
      zip.file("dados.json", JSON.stringify(dados, null, 2));

      const paths: string[] = Array.from(
        new Set(
          ((dados.tables?.pedidos ?? []) as any[])
            .map((p) => p.layout_url)
            .filter((p): p is string => typeof p === "string" && p.length > 0),
        ),
      );

      const total = paths.length;
      let done = 0;
      let arquivosOk = 0;
      let arquivosFalha = 0;

      const layoutsFolder = zip.folder("layouts");
      if (!layoutsFolder) throw new Error("Falha ao criar pasta layouts.");

      setProgressLabel(total > 0 ? `Baixando layouts (0/${total})…` : "Gerando ZIP…");
      setProgress(total > 0 ? 5 : 50);

      // Baixa em pequenas levas para não saturar conexões.
      const CONCURRENCY = 4;
      for (let i = 0; i < paths.length; i += CONCURRENCY) {
        const batch = paths.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map(async (path) => {
            try {
              const { data: signed, error: sErr } = await supabase.storage
                .from("layouts")
                .createSignedUrl(path, 3600);
              if (sErr || !signed?.signedUrl) throw new Error(sErr?.message ?? "URL inválida");
              const res = await fetch(signed.signedUrl);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const buf = await res.arrayBuffer();
              layoutsFolder.file(path, buf);
              arquivosOk += 1;
            } catch {
              arquivosFalha += 1;
            } finally {
              done += 1;
              const pct = Math.round(5 + (done / total) * 85);
              setProgress(Math.min(90, pct));
              setProgressLabel(`Baixando layouts (${done}/${total})…`);
            }
          }),
        );
      }

      setProgressLabel("Compactando ZIP…");
      setProgress(95);
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${ts}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress(100);
      const totalRegistros = Object.values(dados.tables ?? {}).reduce(
        (acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0),
        0,
      );
      setSummary(
        `Backup gerado. ${totalRegistros} registros, ${arquivosOk} layouts incluídos` +
          (arquivosFalha ? ` (${arquivosFalha} falharam)` : "") +
          ".",
      );
      toast.success("Backup exportado.");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao exportar.");
    } finally {
      setExporting(false);
      setProgressLabel("");
    }
  }

  async function handleFile(file: File) {
    setImporting(true);
    setProgress(0);
    setSummary(null);
    setProgressLabel("Lendo arquivo ZIP…");
    try {
      const JSZipMod = (await import("jszip")).default;
      const zip = await JSZipMod.loadAsync(file);
      const dadosEntry = zip.file("dados.json");
      if (!dadosEntry) {
        throw new Error("Arquivo dados.json não encontrado no ZIP.");
      }
      const payload = JSON.parse(await dadosEntry.async("string"));
      if (!payload?.tables) {
        throw new Error("Estrutura inválida em dados.json (esperado { tables: {...} }).");
      }

      const replace = confirm(
        "Deseja SUBSTITUIR os dados existentes?\n\n" +
          "OK = Apagar dados atuais e restaurar do backup.\n" +
          "Cancelar = Mesclar (upsert por id, mantendo registros não presentes no backup).",
      );

      setProgressLabel("Restaurando registros no banco…");
      setProgress(10);
      const res = await importFn({ data: { replace, payload } });
      const totalRegistros = Object.values(res.summary).reduce(
        (acc, s) => acc + (s?.inserted ?? 0),
        0,
      );

      // Coleta arquivos de layouts/ no ZIP.
      const layoutEntries: { path: string; entry: typeof dadosEntry }[] = [];
      zip.forEach((relativePath, entry) => {
        if (entry.dir) return;
        if (!relativePath.startsWith("layouts/")) return;
        const path = relativePath.slice("layouts/".length);
        if (!path) return;
        layoutEntries.push({ path, entry });
      });

      const totalArquivos = layoutEntries.length;
      let arquivosOk = 0;
      let arquivosFalha = 0;
      let processados = 0;

      if (totalArquivos > 0) {
        setProgressLabel(`Enviando layouts (0/${totalArquivos})…`);
        setProgress(30);
        const CONCURRENCY = 3;
        for (let i = 0; i < layoutEntries.length; i += CONCURRENCY) {
          const batch = layoutEntries.slice(i, i + CONCURRENCY);
          await Promise.all(
            batch.map(async ({ path, entry }) => {
              try {
                const blob = await entry.async("blob");
                const file = new File([blob], path.split("/").pop() ?? "layout.pdf", {
                  type: "application/pdf",
                });
                const { error } = await supabase.storage
                  .from("layouts")
                  .upload(path, file, { contentType: "application/pdf", upsert: true });
                if (error) throw error;
                arquivosOk += 1;
              } catch {
                arquivosFalha += 1;
              } finally {
                processados += 1;
                const pct = Math.round(30 + (processados / totalArquivos) * 65);
                setProgress(Math.min(95, pct));
                setProgressLabel(`Enviando layouts (${processados}/${totalArquivos})…`);
              }
            }),
          );
        }
      }

      setProgress(100);
      setProgressLabel("");
      const detalhes = Object.entries(res.summary)
        .map(([t, s]) => `${t}: +${s.inserted}${s.deleted ? ` / -${s.deleted}` : ""}`)
        .join(" • ");
      setSummary(
        `Restaurados ${totalRegistros} registros e ${arquivosOk} arquivos de layout` +
          (arquivosFalha ? ` (${arquivosFalha} falharam)` : "") +
          `. ${detalhes}`,
      );
      toast.success("Backup importado.");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao importar.");
    } finally {
      setImporting(false);
    }
  }

  const busy = exporting || importing;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Exportar Backup</h2>
        <p className="text-sm text-muted-foreground">
          Gera um arquivo ZIP contendo <code>dados.json</code> (todos os registros) e a pasta{" "}
          <code>layouts/</code> com todos os PDFs do bucket privado, preservando os caminhos originais.
        </p>
        <Button onClick={handleExport} disabled={busy}>
          <Download className="h-4 w-4 mr-1" />
          {exporting ? "Exportando…" : "Exportar Backup"}
        </Button>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Importar Backup</h2>
        <p className="text-sm text-muted-foreground">
          Aceita o arquivo ZIP gerado pela exportação. Restaura os dados do banco (perguntando antes
          se deve substituir) e envia automaticamente os PDFs de volta para o bucket{" "}
          <code>layouts</code>, mantendo os caminhos originais.
        </p>
        <input
          ref={(el) => { fileInputRef[1](el); }}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef[0]?.click()}
          disabled={busy}
        >
          <Upload className="h-4 w-4 mr-1" />
          {importing ? "Importando…" : "Importar Backup"}
        </Button>
      </div>

      {(busy || progress > 0 || summary) && (
        <div className="border rounded-lg p-4 space-y-3">
          {(busy || progress > 0) && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {progressLabel || (progress >= 100 ? "Concluído." : "")}
                </span>
                <span className="font-medium tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} />
            </>
          )}
          {summary && !busy && (
            <p className="text-sm text-foreground">{summary}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ListasTab() {
  const sections: { kind: AppListKind; title: string; placeholder: string }[] = [
    { kind: "vendedor", title: "Vendedores", placeholder: "Novo vendedor" },
    { kind: "frete", title: "Frete (transportadoras)", placeholder: "Nova opção de frete" },
    { kind: "pagamento", title: "Tipo de Pagamento", placeholder: "Nova forma de pagamento" },
    { kind: "nf", title: "Nota Fiscal", placeholder: "Nova opção (ex.: Sim, Não, Não se aplica)" },
    { kind: "dtf", title: "Operadores DTF", placeholder: "Novo operador DTF" },
    { kind: "silk", title: "Operadores Silk", placeholder: "Novo operador Silk" },
    { kind: "acabamento", title: "Responsáveis pelo Acabamento", placeholder: "Novo responsável" },
    { kind: "status_arte", title: "Status da Arte", placeholder: "Nova opção de Status da Arte" },
    { kind: "corte_dtf", title: "Quem cortou o DTF", placeholder: "Novo responsável pelo corte" },
    { kind: "revelacao_silk", title: "Quem revelou a tela (Silk)", placeholder: "Nova pessoa" },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {sections.map((s) => (
        <ListaCard key={s.kind} {...s} />
      ))}
    </div>
  );
}

function ListaCard({ kind, title, placeholder }: { kind: AppListKind; title: string; placeholder: string }) {
  const { items, isLoading } = useAppList(kind);
  const { add, rename, remove } = useAppListMutations(kind);
  const [novo, setNovo] = useState("");
  const [editing, setEditing] = useState<{ id: string; nome: string } | null>(null);

  function handleAdd() {
    add.mutate(novo, {
      onSuccess: () => { setNovo(""); toast.success("Adicionado."); },
      onError: (e: any) => toast.error(e.message ?? "Erro ao adicionar."),
    });
  }
  function handleSaveEdit() {
    if (!editing) return;
    rename.mutate(editing, {
      onSuccess: () => { setEditing(null); toast.success("Atualizado."); },
      onError: (e: any) => toast.error(e.message ?? "Erro ao salvar."),
    });
  }
  function handleDelete(id: string, nome: string) {
    if (!confirm(`Excluir "${nome}"?`)) return;
    remove.mutate(id, {
      onSuccess: () => toast.success("Removido."),
      onError: (e: any) => toast.error(e.message ?? "Erro ao remover."),
    });
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h2 className="font-semibold">{title}</h2>
      <div className="flex gap-2">
        <Input
          value={novo}
          placeholder={placeholder}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
        />
        <Button onClick={handleAdd} disabled={add.isPending || !novo.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Nome</TableHead><TableHead className="w-32 text-right">Ações</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={2}>Carregando…</TableCell></TableRow>
          ) : items.length === 0 ? (
            <TableRow><TableCell colSpan={2} className="text-muted-foreground">Nenhum item.</TableCell></TableRow>
          ) : items.map((it) => (
            <TableRow key={it.id}>
              <TableCell>
                {editing?.id === it.id ? (
                  <Input
                    value={editing.nome}
                    autoFocus
                    onChange={(e) => setEditing({ id: it.id, nome: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleSaveEdit(); }
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                ) : it.nome}
              </TableCell>
              <TableCell className="text-right space-x-1">
                {editing?.id === it.id ? (
                  <>
                    <Button size="sm" onClick={handleSaveEdit} disabled={rename.isPending}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: it.id, nome: it.nome })}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(it.id, it.nome)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================
// Aba: Cores (admin only)
// ============================================================
function CoresTab() {
  const { settings, save } = useColorSettingsHook();
  const [draft, setDraft] = useState<ColorSettingsType>(settings);
  // Sincroniza quando settings carrega
  useEffect(() => { setDraft(settings); }, [settings]);

  function setEtapa(key: string, field: "bg" | "fg", value: string) {
    setDraft((d) => ({ ...d, etapas: { ...d.etapas, [key]: { ...d.etapas[key], [field]: value } } }));
  }
  function setBotao(key: BotaoKeyType, field: "bg" | "fg", value: string) {
    setDraft((d) => ({ ...d, botoes: { ...d.botoes, [key]: { ...d.botoes[key], [field]: value } } }));
  }
  function resetDefaults() {
    setDraft(DEFAULT_COLOR_SETTINGS_CONST);
  }
  async function handleSave() {
    try {
      await save.mutateAsync(draft);
      toast.success("Cores atualizadas.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar cores.");
    }
  }

  const BOTOES: { key: BotaoKeyType; label: string }[] = [
    { key: "atualizar", label: "Botão Atualizar (todas as abas)" },
    { key: "finalizar", label: "Botão Finalizar Pedido (Expedição)" },
    { key: "voltar", label: "Dropdown / Botão Voltar" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-md border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Cores dos botões</h2>
            <p className="text-xs text-muted-foreground">Cores aplicadas em todas as abas. Visíveis para todos os usuários.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BOTOES.map(({ key, label }) => {
            const pair = draft.botoes[key];
            return (
              <div key={key} className="rounded-md border p-3 space-y-2">
                <div className="text-sm font-medium">{label}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-md text-sm font-medium border shadow-sm"
                    style={{ backgroundColor: pair.bg, color: pair.fg, borderColor: pair.bg }}
                  >
                    Preview
                  </button>
                </div>
                <div className="flex gap-2 items-center text-xs">
                  <label className="flex items-center gap-1">Fundo
                    <input type="color" value={pair.bg} onChange={(e) => setBotao(key, "bg", e.target.value)} className="h-7 w-10 cursor-pointer rounded border" />
                  </label>
                  <label className="flex items-center gap-1">Fonte
                    <input type="color" value={pair.fg} onChange={(e) => setBotao(key, "fg", e.target.value)} className="h-7 w-10 cursor-pointer rounded border" />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border p-4 space-y-3">
        <div>
          <h2 className="text-base font-semibold">Cores das etapas</h2>
          <p className="text-xs text-muted-foreground">Cor de fundo e cor da fonte do badge de etapa no dashboard.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ETAPAS_CONFIGURAVEIS_CONST.map((etapa) => {
            const pair = draft.etapas[etapa] ?? { bg: "#f1f5f9", fg: "#475569" };
            return (
              <div key={etapa} className="rounded-md border p-3 space-y-2">
                <div className="text-sm font-medium truncate" title={etapa}>{etapa}</div>
                <div>
                  <span
                    className="inline-block px-2 py-0.5 text-xs rounded-md border"
                    style={{ backgroundColor: pair.bg, color: pair.fg, borderColor: `color-mix(in oklab, ${pair.fg} 35%, transparent)` }}
                  >
                    {etapa}
                  </span>
                </div>
                <div className="flex gap-2 items-center text-xs">
                  <label className="flex items-center gap-1">Fundo
                    <input type="color" value={pair.bg} onChange={(e) => setEtapa(etapa, "bg", e.target.value)} className="h-7 w-10 cursor-pointer rounded border" />
                  </label>
                  <label className="flex items-center gap-1">Fonte
                    <input type="color" value={pair.fg} onChange={(e) => setEtapa(etapa, "fg", e.target.value)} className="h-7 w-10 cursor-pointer rounded border" />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={resetDefaults}>Restaurar padrão</Button>
        <Button onClick={handleSave} disabled={save.isPending}>Salvar cores</Button>
      </div>
    </div>
  );
}

