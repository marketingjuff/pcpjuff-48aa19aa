import { useMemo, useRef, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterX, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/format";
import { Th, TH_RAW_CLASS, TD_RAW_CLASS } from "./shared";
import { CanhotoFotoViewer } from "./CanhotoFotoViewer";
import { abrirPdfCanhotos } from "@/lib/canhoto-pdf";
import { enviarFotoCanhoto, fotosDoPedido } from "@/lib/entregas";

interface Props {
  pedidos: Pedido[];
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  saving: boolean;
  soLeitura?: boolean;
}

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function FreteTab({ pedidos, onSave, saving, soLeitura = false }: Props) {
  const [fPed, setFPed] = useState("");
  const [fOrc, setFOrc] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const trocaAlvo = useRef<Pedido | null>(null);

  const lista = useMemo(() => {
    return pedidos
      .filter((p) => p.exp_destino_humberto === true && !p.finalizado_em)
      .filter((p) => {
        if (fPed && !String(p.pedido_olist ?? "").toLowerCase().includes(fPed.toLowerCase())) return false;
        if (fOrc && !String(p.orcamento ?? "").toLowerCase().includes(fOrc.toLowerCase())) return false;
        if (fStatus === "sem_canhoto" && p.canhoto_impresso_em) return false;
        if (fStatus === "aguardando" && (!p.canhoto_impresso_em || p.entrega_confirmada_em)) return false;
        if (fStatus === "entregues" && !p.entrega_confirmada_em) return false;
        return true;
      })
      .sort((a, b) => (a.data_entrega ?? "9999-12-31").localeCompare(b.data_entrega ?? "9999-12-31"));
  }, [pedidos, fPed, fOrc, fStatus]);

  const selecionados = lista.filter((p) => selectedIds.has(p.id));
  const todosMarcados = lista.length > 0 && selecionados.length === lista.length;

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function gerarCanhotos() {
    if (soLeitura || selecionados.length === 0) return;
    try {
      await abrirPdfCanhotos(selecionados);
      const agora = new Date().toISOString();
      selecionados.forEach((p) => onSave({ id: p.id, canhoto_impresso_em: agora }));
      toast.success(`${selecionados.length} canhoto(s) gerado(s).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar os canhotos.");
    }
  }

  function pedirTrocaFoto(p: Pedido) {
    if (soLeitura) return;
    trocaAlvo.current = p;
    fileRef.current?.click();
  }

  async function handleArquivo(file: File | undefined) {
    const p = trocaAlvo.current;
    trocaAlvo.current = null;
    if (fileRef.current) fileRef.current.value = "";
    if (!p || !file) return;
    setEnviando(p.id);
    try {
      const fotos = await enviarFotoCanhoto(p, file);
      onSave({ id: p.id, canhoto_fotos: fotos });
      toast.success("Foto do canhoto atualizada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar a foto.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleArquivo(e.target.files?.[0])}
      />
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-baseline justify-between gap-2">
            <CardTitle className="text-base">Frete — canhotos para o Humberto</CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {lista.length} {lista.length === 1 ? "registro" : "registros"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
            <Input placeholder="Pedido" value={fPed} onChange={(e) => setFPed(e.target.value)} />
            <Input placeholder="Orçamento" value={fOrc} onChange={(e) => setFOrc(e.target.value)} />
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sem_canhoto">Sem canhoto impresso</SelectItem>
                <SelectItem value="aguardando">Aguardando entrega</SelectItem>
                <SelectItem value="entregues">Entregues</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => { setFPed(""); setFOrc(""); setFStatus("todos"); }}>
              <FilterX className="h-4 w-4 mr-1" /> Limpar Filtros
            </Button>
            {!soLeitura && (
              <Button size="sm" disabled={selecionados.length === 0 || saving} onClick={gerarCanhotos}>
                <Printer className="h-4 w-4 mr-1" /> Gerar canhotos ({selecionados.length})
              </Button>
            )}
          </div>

          {lista.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhum pedido despachado para o Humberto no momento.</div>
          ) : (
            <div className="overflow-auto rounded-md border tbl-congelada">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={TH_RAW_CLASS}>
                      <Checkbox
                        checked={todosMarcados}
                        onCheckedChange={(v) =>
                          setSelectedIds(v ? new Set(lista.map((p) => p.id)) : new Set())
                        }
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <Th>Pedido</Th>
                    <Th>Orçamento</Th>
                    <Th>Vendedor</Th>
                    <Th>Data limite</Th>
                    <Th>Horário comercial</Th>
                    <Th>Canhoto</Th>
                    <Th>Entrega</Th>
                    <Th>Foto</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className={TD_RAW_CLASS}>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleId(p.id)}
                          aria-label={`Selecionar pedido ${p.pedido_olist ?? ""}`}
                        />
                      </TableCell>
                      <TableCell className={`${TD_RAW_CLASS} font-semibold tabular-nums`}>{p.pedido_olist ?? "—"}</TableCell>
                      <TableCell className={TD_RAW_CLASS}>{p.orcamento ?? "—"}</TableCell>
                      <TableCell className={TD_RAW_CLASS}>{p.vendedor ?? "—"}</TableCell>
                      <TableCell className={`${TD_RAW_CLASS} tabular-nums`}>{formatDateBR(p.data_entrega) || "—"}</TableCell>
                      <TableCell className={TD_RAW_CLASS}>
                        <Checkbox
                          disabled={soLeitura || saving}
                          checked={p.canhoto_horario_comercial === true}
                          onCheckedChange={(v) => onSave({ id: p.id, canhoto_horario_comercial: v === true })}
                          aria-label="Horário comercial"
                        />
                      </TableCell>
                      <TableCell className={`${TD_RAW_CLASS} tabular-nums`}>
                        {p.canhoto_impresso_em ? `Impresso em ${formatDateBR(p.canhoto_impresso_em.slice(0, 10))}` : "—"}
                      </TableCell>
                      <TableCell className={TD_RAW_CLASS}>
                        {p.entrega_confirmada_em ? (
                          <Badge variant="outline" className="bg-success/15 text-success border-success/30">
                            Entregue {fmtDataHora(p.entrega_confirmada_em)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className={TD_RAW_CLASS}>
                        <div className="flex items-center justify-center gap-1">
                          {fotosDoPedido(p).length > 0 && <CanhotoFotoViewer pedido={p} label="Foto" />}
                          {!soLeitura && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={enviando === p.id || saving}
                              onClick={() => pedirTrocaFoto(p)}
                            >
                              {enviando === p.id ? "Enviando…" : "Trocar foto"}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
