import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isAtrasadoSetor, type Pedido, type SetorAtraso } from "@/lib/pedidos";
import { criarClienteDoUsuario, hojeISO, linkSistema, lerTudo, responder } from "../supabase";
import { carregarPermissoes, etapaDoPedido, exigir } from "../permissoes";

const SETORES: SetorAtraso[] = ["arte", "dtf", "silk", "acabamento", "expedicao"];
const addDias = (iso: string, d: number) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };

export default defineTool({
  name: "producao_panorama",
  title: "Panorama da produção",
  description:
    "Fotografia da produção em aberto: pedidos e peças por etapa, batidas na fila, atrasos por setor, o que vence nesta semana e na próxima e o que está parado. Use para perguntas como como está a fábrica hoje.",
  inputSchema: {
    ate: z.string().optional().describe("Data de referência (AAAA-MM-DD); padrão hoje."),
    dias_parado: z.number().int().min(1).max(60).optional().describe("Dias sem mexer para considerar parado (padrão 3)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    const sb = criarClienteDoUsuario(ctx);
    const perm = await carregarPermissoes(sb, ctx);
    exigir(perm, ["pcp.dashboard", "pcp.monitor", "kpi.pcp"], "panorama da produção");
    const ref = a.ate ?? hojeISO();
    const diasParado = a.dias_parado ?? 3;
    const rows = await lerTudo<Pedido>((f, t) => sb.from("pedidos").select("*").is("finalizado_em", null).range(f, t));
    const porEtapa: Record<string, { pedidos: number; pecas: number }> = {};
    const atrasados: Record<string, number> = Object.fromEntries(SETORES.map((s) => [s, 0]));
    let batidasDtf = 0, batidasSilk = 0;
    const d = new Date(ref + "T00:00:00Z");
    const dow = (d.getUTCDay() + 6) % 7;
    const fimSemana = addDias(ref, 6 - dow), fimProxima = addDias(fimSemana, 7);
    let vencemSemana = 0, vencemProxima = 0;
    const limiteParado = new Date(new Date(ref + "T00:00:00Z").getTime() - diasParado * 86400000).toISOString();
    const parados: { id: string; pedido_olist: string | null; etapa: string; sem_mexer_desde: string; link: string }[] = [];
    for (const p of rows) {
      const { etapa } = etapaDoPedido(p);
      const e = (porEtapa[etapa] ??= { pedidos: 0, pecas: 0 });
      e.pedidos++; e.pecas += Number(p.qtd ?? 0);
      if (etapa === "Aguardando DTF" || etapa === "Aguardando DTF + Silk") batidasDtf += Number((p as any).n_batidas_dtf ?? 0);
      if (etapa === "Aguardando Silk" || etapa === "Aguardando DTF + Silk") batidasSilk += Number((p as any).n_batidas_silk ?? 0);
      for (const s of SETORES) if (isAtrasadoSetor(p, s)) atrasados[s]++;
      if (p.data_entrega && p.data_entrega >= ref && p.data_entrega <= fimSemana) vencemSemana++;
      else if (p.data_entrega && p.data_entrega > fimSemana && p.data_entrega <= fimProxima) vencemProxima++;
      const upd = String((p as any).updated_at ?? "");
      if (upd && upd < limiteParado) parados.push({ id: p.id, pedido_olist: p.pedido_olist, etapa, sem_mexer_desde: upd.slice(0, 10), link: `https://pcpjuff.lovable.app/?pedidoId=${p.id}` });
    }
    return responder({
      data_referencia: ref,
      pedidos_em_aberto: rows.length,
      por_etapa: porEtapa,
      batidas_na_fila: { dtf: batidasDtf, silk: batidasSilk },
      atrasados_por_setor: atrasados,
      vencem_esta_semana: vencemSemana,
      vencem_semana_que_vem: vencemProxima,
      parados_ha_mais_de_dias: diasParado,
      parados: parados.slice(0, 50),
      link: linkSistema("pcp", null, "dashboard"),
    });
  },
});
