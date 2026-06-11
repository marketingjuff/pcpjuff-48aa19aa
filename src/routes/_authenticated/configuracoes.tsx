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
import { ArrowLeft, Trash2, Plus, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useMyRoles } from "@/hooks/use-role";
import {
  createUserAccount,
  listUsers,
  updateUserRole,
  deleteUserAccount,
} from "@/lib/admin.functions";
import { exportBackup, importBackup } from "@/lib/backup.functions";
import type { AppRole, Feriado } from "@/integrations/supabase/schema-extras";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesPage,
});

const ROLES: AppRole[] = ["admin", "gestor", "arte", "dtf", "silk", "acabamento"];

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
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
            <h1 className="text-lg font-semibold">Configurações</h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue={isAdmin ? "feriados" : "backup"}>
          <TabsList className="mb-6">
            {isAdmin && <TabsTrigger value="feriados">Feriados</TabsTrigger>}
            {isAdmin && <TabsTrigger value="usuarios">Usuários</TabsTrigger>}
            <TabsTrigger value="backup">Backup</TabsTrigger>
          </TabsList>
          {isAdmin && <TabsContent value="feriados"><FeriadosTab /></TabsContent>}
          {isAdmin && <TabsContent value="usuarios"><UsuariosTab /></TabsContent>}
          <TabsContent value="backup"><BackupTab /></TabsContent>
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
