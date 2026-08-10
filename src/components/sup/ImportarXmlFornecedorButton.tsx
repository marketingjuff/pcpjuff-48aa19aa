import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FornecedorDialog } from "@/components/sup/FornecedorDialog";
import { fmtDataBR, type SupFornecedor } from "@/lib/sup";
import {
  condicaoPagamentoNFe, normalizarNome, parseNFe, soDigitos,
  type NFeParsed,
} from "@/lib/nfe-xml";

type Props = {
  fornecedores: SupFornecedor[];
  onSelecionarFornecedor: (id: string) => void;
};

export function ImportarXmlFornecedorButton({ fornecedores, onSelecionarFornecedor }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState<SupFornecedor | null>(null);
  const [avisoCnpj, setAvisoCnpj] = useState<SupFornecedor | null>(null);
  const [avisoNome, setAvisoNome] = useState<{ existente: SupFornecedor; parsed: NFeParsed } | null>(null);

  function novoFornecedorDoXml(p: NFeParsed): SupFornecedor {
    const { emitente, nota } = p;
    return {
      razao_social: emitente.razao_social,
      nome_fantasia: emitente.nome_fantasia,
      documento: emitente.cnpj,
      contato_telefone: emitente.telefone,
      cidade: emitente.cidade,
      uf: emitente.uf,
      condicao_pagamento_padrao: condicaoPagamentoNFe(nota.emissao, nota.vencimentos),
      ativo: true,
      observacoes: `Importado do XML da NF-e nº ${nota.numero ?? "—"} (${fmtDataBR(nota.emissao)}).`,
    } as unknown as SupFornecedor;
  }

  function vincularAoExistente(existente: SupFornecedor, p: NFeParsed) {
    const doXml = novoFornecedorDoXml(p) as unknown as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...(existente as unknown as Record<string, unknown>) };
    for (const [k, v] of Object.entries(doXml)) {
      const atual = merged[k];
      const vazio = atual == null || (typeof atual === "string" && atual.trim() === "");
      if (vazio && v != null && !(typeof v === "string" && v.trim() === "")) merged[k] = v;
    }
    setPrefill(merged as unknown as SupFornecedor);
    setDialogOpen(true);
  }

  async function aoEscolherArquivo(file: File) {
    let parsed: NFeParsed;
    try {
      parsed = parseNFe(await file.text());
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível ler o XML.");
      return;
    }
    const cnpj = parsed.emitente.cnpj;
    const porCnpj = cnpj ? fornecedores.find((f) => soDigitos(f.documento) === cnpj) : undefined;
    if (porCnpj) {
      setAvisoCnpj(porCnpj);
      return;
    }
    const alvo = normalizarNome(parsed.emitente.razao_social);
    const alvoFant = normalizarNome(parsed.emitente.nome_fantasia ?? "");
    const porNome = fornecedores.find(
      (f) =>
        (alvo && normalizarNome(f.razao_social) === alvo) ||
        (alvo && normalizarNome(f.nome_fantasia ?? "") === alvo) ||
        (alvoFant && normalizarNome(f.razao_social) === alvoFant) ||
        (alvoFant && normalizarNome(f.nome_fantasia ?? "") === alvoFant),
    );
    if (porNome) {
      setAvisoNome({ existente: porNome, parsed });
      return;
    }
    setPrefill(novoFornecedorDoXml(parsed));
    setDialogOpen(true);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await aoEscolherArquivo(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <Button size="sm" variant="outline" className="h-8" onClick={() => inputRef.current?.click()}>
        <FileUp className="h-4 w-4 mr-1" />
        Importar XML
      </Button>

      <AlertDialog open={!!avisoCnpj} onOpenChange={(v) => !v && setAvisoCnpj(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fornecedor já cadastrado</AlertDialogTitle>
            <AlertDialogDescription>
              {avisoCnpj?.razao_social} já está no cadastro com este CNPJ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (avisoCnpj) onSelecionarFornecedor(avisoCnpj.id);
                setAvisoCnpj(null);
              }}
            >
              Abrir cadastro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!avisoNome} onOpenChange={(v) => !v && setAvisoNome(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Possível fornecedor já cadastrado</AlertDialogTitle>
            <AlertDialogDescription>
              Existe {avisoNome?.existente.razao_social} com nome parecido, mas sem este CNPJ
              registrado. Deseja vincular o XML a esse cadastro (preenchendo os dados que faltam) ou
              criar um fornecedor novo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                if (avisoNome) {
                  const p = avisoNome.parsed;
                  setAvisoNome(null);
                  setPrefill(novoFornecedorDoXml(p));
                  setDialogOpen(true);
                }
              }}
            >
              Criar novo
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (avisoNome) {
                  const { existente, parsed } = avisoNome;
                  setAvisoNome(null);
                  vincularAoExistente(existente, parsed);
                }
              }}
            >
              Vincular ao existente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FornecedorDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setPrefill(null);
        }}
        fornecedor={prefill}
        onSaved={(id) => {
          if (id) onSelecionarFornecedor(id);
        }}
      />
    </>
  );
}
