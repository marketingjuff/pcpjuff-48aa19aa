import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import {
  MODULOS, CATALOGO_PERMISSOES, normalizarPermissoes, permissoesDoModulo, todasPermissoes,
  type ModuloKey, type PermissaoKey,
} from "@/lib/permissoes";
import { calcularEtapaAtual, type Pedido } from "@/lib/pedidos";
import type { ClienteUsuario } from "./supabase";

export type Perm = {
  ehAdmin: boolean;
  papeis: string[];
  perms: Set<PermissaoKey>;
  pode: (key: PermissaoKey) => boolean;
  podeAlguma: (keys: PermissaoKey[]) => boolean;
  modulosLiberados: ModuloKey[];
};

/** Igual a useMinhasPermissoes() do navegador, rodando no servidor. */
export async function carregarPermissoes(sb: ClienteUsuario, ctx: ToolContext): Promise<Perm> {
  const uid = ctx.getUserId();
  if (!uid) throw new ToolError("Não consegui ler suas permissões.");
  const { data, error } = await sb.from("user_roles").select("role, areas_extras").eq("user_id", uid);
  if (error || !data) throw new ToolError("Não consegui ler suas permissões.");
  const ehAdmin = data.some((r) => r.role === "admin");
  const perms = new Set<PermissaoKey>();
  if (ehAdmin) todasPermissoes().forEach((k) => perms.add(k));
  else for (const r of data) normalizarPermissoes(r.areas_extras ?? [], r.role).forEach((k) => perms.add(k));
  const pode = (k: PermissaoKey) => perms.has(k);
  const podeAlguma = (ks: PermissaoKey[]) => ks.some(pode);
  return {
    ehAdmin,
    papeis: data.map((r) => String(r.role)),
    perms,
    pode,
    podeAlguma,
    modulosLiberados: MODULOS.map((m) => m.key).filter((m) => permissoesDoModulo(m).some(pode)),
  };
}

export function exigir(perm: Perm, keys: PermissaoKey[], descricao: string): void {
  if (!perm.podeAlguma(keys)) throw new ToolError(`Sem acesso a ${descricao} no PCP Juff.`);
}

/** Abas (não ações) de um módulo. */
export function abasDe(modulo: ModuloKey): PermissaoKey[] {
  return CATALOGO_PERMISSOES.filter((a) => a.modulo === modulo && !a.acao).map((a) => a.key);
}

export function exigirAdmin(perm: Perm, descricao: string): void {
  if (!perm.ehAdmin) throw new ToolError(`Sem acesso a ${descricao} no PCP Juff (só admin).`);
}

type RegraEtapa = { perms: PermissaoKey[]; tab: string; chave: string };

const REGRAS: Record<string, RegraEtapa> = {
  "Aguardando entrada": { perms: ["pcp.dados_in_vendedor", "pcp.dados_in_producao"], tab: "dados", chave: "dados_in" },
  "Aguardando input de produção": { perms: ["pcp.dados_in_vendedor", "pcp.dados_in_producao"], tab: "dados", chave: "dados_in" },
  "Aguardando Arte": { perms: ["pcp.arte"], tab: "arte", chave: "arte" },
  "DTF Liberado / Silk na Arte": { perms: ["pcp.arte"], tab: "arte", chave: "arte" },
  "Silk Liberado / DTF na Arte": { perms: ["pcp.arte"], tab: "arte", chave: "arte" },
  "Aguardando DTF": { perms: ["pcp.dtf"], tab: "dtf", chave: "dtf" },
  "Aguardando Silk": { perms: ["pcp.silk"], tab: "silk", chave: "silk" },
  "Aguardando DTF + Silk": { perms: ["pcp.dtf", "pcp.silk"], tab: "dtf", chave: "dtf" },
  "Aguardando Acabamento": { perms: ["pcp.acabamento"], tab: "acab", chave: "acabamento" },
  "Aguardando Expedição": { perms: ["pcp.expedicao", "pcp.frete"], tab: "exp", chave: "expedicao" },
  "Saiu para entrega": { perms: ["pcp.expedicao", "pcp.frete"], tab: "exp", chave: "expedicao" },
  "Entregue": { perms: ["pcp.expedicao", "pcp.frete"], tab: "exp", chave: "expedicao" },
  "Finalizado": { perms: ["pcp.finalizados"], tab: "fin", chave: "finalizado" },
};

/** Etapa calculada, sem o sufixo de asteriscos. */
export function etapaDoPedido(p: Pedido): { etapa: string; percentual: number } {
  const r = calcularEtapaAtual(p);
  return { etapa: r.etapa.replace(/\s*\*+\s*$/, "").trim(), percentual: r.percentual };
}

/** Etapa → chave de filtro (dados_in, arte, dtf, silk, acabamento, expedicao, finalizado). */
export function chaveDaEtapa(etapa: string): string | null {
  return REGRAS[etapa]?.chave ?? null;
}

export function tabDoPedido(p: Pedido): string {
  return REGRAS[etapaDoPedido(p).etapa]?.tab ?? "dados";
}

export function pedidoVisivel(perm: Perm, p: Pedido): boolean {
  if (perm.ehAdmin) return true;
  if (perm.podeAlguma(["pcp.dashboard", "pcp.monitor"])) return true;
  const refacoes = (p as unknown as { refacoes?: unknown[] }).refacoes;
  if (Array.isArray(refacoes) && refacoes.length > 0 && perm.pode("pcp.retrabalho")) return true;
  const regra = REGRAS[etapaDoPedido(p).etapa];
  return !!regra && perm.podeAlguma(regra.perms);
}
