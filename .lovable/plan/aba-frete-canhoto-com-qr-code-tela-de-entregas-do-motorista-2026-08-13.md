# Aba FRETE + Canhoto com QR Code + Tela de Entregas do Motorista

Implementação exatamente conforme o prompt enviado, respeitando o allowlist de arquivos.

## 1. Banco (migração aditiva, sem DROP/ALTER de tipo)

```sql
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS exp_destino_humberto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canhoto_horario_comercial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canhoto_impresso_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS canhoto_fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS entrega_confirmada_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS entrega_confirmada_por uuid NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('canhotos', 'canhotos', false)
ON CONFLICT (id) DO NOTHING;
```

Mais 4 policies em `storage.objects` (SELECT/INSERT/UPDATE/DELETE) para `authenticated`
com `bucket_id = 'canhotos' AND public.is_team_member()`, espelhando o bucket `layouts`.
`exp_despachado` continua boolean e intacta.

## 2. Arquivos novos

- `src/lib/canhoto-pdf.ts` — `abrirPdfCanhotos(pedidos)`: gera todos os QR (`qrcode`, data URL)
  antes de montar o HTML, monta 5 tiras de 54mm por A4 (borda 1.5pt, corpo 8.5pt, `esc()` local),
  abre janela e chama `print()`. QR de 22mm aponta para
  `https://pcpjuff.lovable.app/entregas?p=<id>` com o número repetido embaixo em 7pt.
  Campos manuscritos com `border-bottom`, quadradinho de horário comercial com X só quando marcado.
- `src/lib/entregas.ts` — helpers compartilhados: compressão via canvas (máx. 1600px, JPEG 0.7),
  upload para `canhotos/${pedido.id}/${uuid}.jpg`, append em `canhoto_fotos`, signed URL de 60s,
  filtros de pendentes/entregues.
- `src/components/pcp/FreteTab.tsx` — lista `exp_destino_humberto = true` e não finalizados;
  filtros (pedido, orçamento, status), seleção múltipla, colunas do prompt, botão
  "Gerar canhotos (N)" que imprime e grava `canhoto_impresso_em = now()` em cada selecionado,
  checkbox de horário comercial por linha, botão de foto e "Trocar foto". Respeita `soLeitura`.
- `src/components/pcp/CanhotoFotoViewer.tsx` — Dialog com a foto mais recente (signed URL 60s),
  botão de abrir em nova aba e linha "N versões — exibindo a mais recente (…)".
- `src/routes/_authenticated/entregas.tsx` — rota isolada (sem header/menu/abas), mobile-first:
  modo lista (Pendentes/Entregues, cartões grandes, botão fixo "📷 LER QR CODE") e modo pedido
  (foto obrigatória via `capture="environment"`, prévia, "Tirar outra"/"Confirmar entrega";
  se já entregue mostra foto atual + "Trocar foto" sem mexer em `entrega_confirmada_em`).
  Scanner `html5-qrcode` com câmera traseira e `.stop()` garantido no unmount. Entra por `?p=<id>`.
  Sem `entregas.motorista` e sem ser admin → "Sem acesso".

## 3. Arquivos editados

- `src/lib/pedidos.ts` — 6 campos novos em `Pedido` e `PedidoInsert`.
- `src/lib/permissoes.ts` — `pcp.frete` logo após `pcp.expedicao` (+ preset `operador_expedicao`),
  módulo `entregas` no fim de `MODULOS`, `entregas.motorista` no fim do catálogo e preset
  `motorista`.
- `src/components/pcp/ExpedicaoTab.tsx` — terceira opção "Sim, para o Humberto" no select
  Despachado (par `exp_despachado` + `exp_destino_humberto`), incluída em `handleSave` e
  `handleFinalizar`; `marcarTudoSim` inalterado. Botão "Ver canhoto" quando houver foto.
- `src/routes/_authenticated/index.tsx` — registro da aba Frete no padrão existente.
- `src/components/pcp/FinalizadosTab.tsx` — linha "Canhoto" com botão de visualizar.
- `src/lib/audit-labels.ts` — rótulos em português dos 6 campos.
- `package.json` — `qrcode` (+ `@types/qrcode`) e `html5-qrcode`. `xlsx` fica intocado.

Nenhum outro arquivo é tocado; `src/lib/cop-saldos.ts` permanece intacto.
