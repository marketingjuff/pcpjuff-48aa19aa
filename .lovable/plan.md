## Aba Romaneio do COP — Plano

Tudo aditivo. Não toca em `pedidos` nem na lógica PCP. Mantém visual do COP (moldura verde, badges, cores). Vocabulário Modelo/Cor/Tamanho continua vindo das constantes `REFACAO_*` de `src/lib/pedidos.ts`.

### 1) Banco (migração aditiva)

Apenas `ADD COLUMN` em `public.cops` e novas policies se necessário. Nada de DROP/RENAME.

Colunas novas em `cops`:
- `oficina_id uuid null references public.oficinas(id)`
- `data_saida_oficina date null` ("Data de saída do COP")
- `data_recebimento date null` ("Data de recebimento do COP")
- `observacoes_romaneio text null`
- `num_fretes integer not null default 1`
- `pecas_recebidas jsonb not null default '[]'::jsonb`
  Estrutura espelhando `pecas`: `[{modelo,cor,tamanho,qtd_recebida,completo:boolean}]`. Pendente = `qtd - qtd_recebida`.
- `romaneio_enviado_em timestamptz null` (controla quando o PDF foi gerado pela 1ª vez)
- `letra text null` (null = romaneio inteiro; `'A'`, `'B'`, `'C'`… quando particionado)
- `cop_romaneio_pai_id uuid null references public.cops(id)` (relação A/B/C — distinta de `cop_pai_id` que é da Divisão de Corte)

Aproveita policies já existentes de `cops` (admin-only); sem novas tabelas.

### 2) Novo status no fluxo COP

Em `src/lib/cop.ts` ampliar `CopStatus` (aditivo) com:
- `"Na Oficina (Costura)"` — após "Enviar para Oficina"
- `"Romaneio Parcial"` — recebimento iniciado, pendência > 0
- `"Romaneio Completo"` — tudo recebido (libera Conferência)

Mantém os demais. Mapa de cores em `use-cop-color-settings` ganha entradas com defaults.

### 3) Componentes novos (em `src/components/cop/`)

- `RomaneioTab.tsx` — orquestra lista de COPs elegíveis (status `Aguardando Romaneio`, `Na Oficina (Costura)`, `Romaneio Parcial`, `Romaneio Completo`), filtros, contador "X registros", botão "Atualizar". Layout split: editor (esquerda Ordem de Produção, direita Conferência).
- `OrdemProducaoPanel.tsx` — formulário do lado esquerdo:
  - Dropdown Oficina (lê `oficinas`)
  - Data de saída / Data de recebimento
  - Tabela read-only das peças (Modelo · Cor · Tamanho · Qtd) puxada de `cops.pecas`
  - Observações (textarea, uppercase como nas demais)
  - `num_fretes` (input inteiro, mínimo 1)
  - Botões: **Atualizar**, **Enviar para Oficina** (gate: oficina + data_saida obrigatórios), **Entrega de Romaneio**, **Baixar PDF** (aparece após envio), **Dividir Corte** (reusa `DivisaoCorteDialog`), **Particionar Romaneio** (só com Parcial)
- `EntregaRomaneioDialog.tsx` — popup de recebimento:
  - Por linha (Modelo · Cor): mostra cada tamanho como célula com número grande e ícone abaixo.
  - Click no número → marca completo (bolinha verde, número branco), seta `qtd_recebida = qtd`.
  - Click no ícone → input numérico para parcial (bolinha cinza, número branco).
  - Rodapé por linha: entregue vs pendente.
  - Salvar atualiza `pecas_recebidas` e recalcula status (parcial vs completo).
- `ParticionarRomaneioDialog.tsx` — só habilitado em `Romaneio Parcial`:
  - Cria filho `0001B` (próxima letra livre) com as **peças já recebidas** (snapshot do parcial), `cop_romaneio_pai_id` = atual, mesma `oficina_id`, status `Romaneio Completo`, `pecas_recebidas` = peças filhas marcadas completas.
  - Pai vira `0001A` (primeira partição) ou mantém letra atual se já tem; subtrai as peças particionadas das peças e zera os recebimentos correspondentes. Pode reparticionar (C, D…).
  - Exibição "0001 (0001A / 0001B)" análoga à Divisão de Corte.
- `ConferenciaPanel.tsx` — lado direito, habilitado só com `Romaneio Completo`. Confere **somente quantidades** (sem defeitos). Marca conferido com data + responsável. (Defeitos = aba Perdas, prompt 3.)
- `RomaneioPdf.tsx` — componente que monta o layout do romaneio para impressão.

### 4) PDF do Romaneio — abordagem proposta

Sem adicionar dependência pesada agora: **impressão via layout HTML + `@media print`**, abrindo em popup `window.open`. A4 vertical com **dois A5 horizontais** idênticos (cabeçalho com Logo Juff, datas, oficina, nº COP, peças por Modelo/Cor/Tamanho/Qtd, total, "Responsável pela conferência", Observações ~10%). Botão "Baixar PDF" usa o mesmo HTML e o `window.print()` → "Salvar como PDF" do navegador, com `document.title = "romaneio-0001"` para o nome sugerido. Se preferir um `.pdf` real baixável, adicionar `html2pdf.js` (leve, ~50kb) — peço confirmação antes de instalar.

### 5) Wiring

- `src/routes/_authenticated/cop.tsx`: trocar `CopEmConstrucao` por `<RomaneioTab />` na aba `romaneio`. Demais abas continuam placeholders.
- Sem alterações em PCP, configurações ou demais módulos.

### 6) Regras invioláveis aplicadas

- Sem `DROP`/`TRUNCATE`/`DELETE` em massa. Só `ADD COLUMN`.
- Save nunca bloqueado por gate de etapa (gates apenas em ações como "Enviar para Oficina" e "Entrega").
- Reusa constantes existentes; nenhuma lista nova de modelo/cor/tamanho.
- Divisão de Corte segue regra existente (única; filho não divide). Partição por letra é independente e reparticionável.

### Pendências antes de implementar

1. **PDF**: ok usar `window.print()` (sem nova dep) ou prefere instalar `html2pdf.js` para download real `.pdf`?
2. **Conferência (lado direito)**: além de confirmar quantidades, devo registrar `conferido_por` (usuário) e `conferido_em` (timestamp) como colunas novas em `cops`? Confirmo no plano antes de migrar.

Aguardo "ok" para implementar.