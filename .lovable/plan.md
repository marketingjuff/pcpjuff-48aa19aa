# Mostrar a área real do erro no Controle de Perdas (COP)

Só exibição e o campo enviado ao reclassificar. Nada de migração, SQL ou alteração de dados.

## Regra (igual nos pontos)
1. Tem `area_erro` → mostra a área (Arte, DTF, Silk, Acabamento...).
2. Senão, `erro_producao = true` → "Produção" (registro antigo).
3. Senão → "—".

## Arquivos

### src/components/cop/ControlePerdasTab.tsx
- Ordenação `area` (linha 111): `p.area_erro ?? (p.erro_producao ? "Produção" : "")` — o vazio final continua.
- Variável `areaErro` (linha 253): `p.area_erro ?? (p.erro_producao ? "Produção" : "—")`, só para origem PCP; o resto da linha não muda.

### src/components/cop/PerdaDetalheDialog.tsx
- Linha "Área do erro" (linha 61): mesma regra. A condição em volta não muda. O bloco "Histórico — Reclassificada" não muda.

### src/components/cop/CorrigirPerdaDialog.tsx
- Texto "Área original" (cerca da linha 95): mesma regra, com "—" no final.
- Campo `area_erro_original` enviado ao salvar (cerca da linha 65): `perda.area_erro ?? (perda.erro_producao ? "Produção" : null)` — o `null` final continua.

## Conferência
Rodar o typecheck e mostrar o resultado. Nenhum outro arquivo é tocado.
