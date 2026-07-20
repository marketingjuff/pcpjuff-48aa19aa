# Refação: rótulo "Erro de Produção da Estamparia" + nova pergunta "Faltou adesivo?"

Sem migration. Campos novos vivem apenas dentro do JSONB do episódio de refação.

## Arquivos tocados

1. `src/components/pcp/RefacaoDialog.tsx`
2. `src/components/pcp/VoltarDropdown.tsx` (forçar destino = Arte quando faltou adesivo)
3. `src/lib/pedidos.ts` (só o type `RefacaoEpisodio`)
4. `src/components/pcp/refacao-helpers.ts` (só a montagem do episódio novo)
5. `src/components/pcp/RetrabalhoTab.tsx` (só leitura/exibição)
6. `src/components/pcp/RefacaoViewerButton.tsx` (só leitura/exibição)

Nenhum arquivo do COP será tocado.

## Mudanças

### 1. `RefacaoDialog.tsx`

**Renomear label:**
- De: `Houve erro da produção? *`
- Para: `Houve erro de produção da Estamparia (Arte, DTF, Silk ou Acabamento)? *`

Lógica de `erroProd` e opções de "Qual área errou?" permanecem iguais.

**Nova pergunta independente "Faltou adesivo?"** — dentro do bloco `mostraAdesivos`. Independente de "Houve perda de adesivos?".

Novos estados:
```ts
const [houveFaltaAdesivos, setHouveFaltaAdesivos] = useState<"sim" | "nao" | "">("");
const [faltaAdesivos, setFaltaAdesivos] = useState<string>("");
```
Resetados no `useEffect` de abertura.

Layout: segunda linha no mesmo grid `grid-cols-2 gap-2`, mesmo padrão visual (Sim/Não + input condicional "Quantos adesivos faltaram?", `min=1`).

**Regra de destino obrigatório (nova):** se `houveFaltaAdesivos === "sim"`, o destino da refação deve ser forçado para **Arte**. Implementação:
- O dialog recebe `destino` via props (já recebe hoje). Adicionar prop `onForcarDestinoArte?: () => void`.
- Assim que o usuário marca "Faltou adesivo? = Sim", exibir uma nota destacada abaixo do campo: *"Faltou adesivo obriga refazer a partir da Arte — o destino será ajustado automaticamente."*
- Na validação `confirmar()`, se `houveFaltaAdesivos === "sim"` e o `destino` recebido não for `"arte"`, bloquear com erro: *"Faltou adesivo — refação deve ser feita para a Arte. Ajuste no seletor 'Refazer para...'."*

**Ajuste em `VoltarDropdown.tsx`:** passar callback ao `RefacaoDialog` e, quando o dialog sinalizar "faltou adesivo = sim", trocar `sel` para `"arte"` automaticamente antes do `onVoltar`. Alternativa simples e usada: no `onConfirm`, se `payload.falta_adesivos === true`, sobrescrever o destino chamado para `"arte"`:
```ts
onConfirm={(payload) => {
  setDialogOpen(false);
  const dest = payload.falta_adesivos ? "arte" : sel;
  onVoltar(dest, payload);
}}
```
Só o `VoltarDropdown` é tocado — nada de mudar `refacao-helpers` além dos campos novos.

Validação em `confirmar()` (dentro do `if (mostraAdesivos)`):
- `houveFaltaAdesivos === ""` → "Informe se faltou adesivo."
- `houveFaltaAdesivos === "sim"` + qtd inválida (`< 1`) → "Informe quantos adesivos faltaram."

Payload — adicionar ao `RefacaoFormPayload` e ao `onConfirm`:
```ts
falta_adesivos?: boolean;
qtd_falta_adesivos?: number;
```
**Nunca** somados a `perda_adesivos`.

### 2. `src/lib/pedidos.ts`

No `type RefacaoEpisodio`, junto dos campos opcionais existentes:
```ts
falta_adesivos?: boolean;
qtd_falta_adesivos?: number;
```

### 3. `src/components/pcp/refacao-helpers.ts`

Na criação do `novo: RefacaoEpisodio` em `montarRefacoesAposRefazer`, copiar os dois campos do payload junto de `area_identificou`/`erro_producao`/`area_erro`/`problema`. Nenhuma outra alteração — o destino já é passado por fora (`VoltarDropdown` força para `"arte"`).

### 4. `RetrabalhoTab.tsx` e `RefacaoViewerButton.tsx`

- Renomear leitura de `"Erro da produção"` → `"Erro de produção da Estamparia"`. Valor exibido igual.
- Adicionar campo logo abaixo de "Adesivos perdidos":
  - label: `"Faltou adesivo?"`
  - valor: `(episodio.qtd_falta_adesivos ?? 0) > 0 ? \`Sim — ${episodio.qtd_falta_adesivos}\` : "Não"`
- **Não alterar** `totalPerdaAdesivos` — segue somando apenas `perda_adesivos`.

## Garantias

- Sem `ALTER TABLE` / `CREATE TABLE`.
- `qtd_falta_adesivos` jamais entra em contabilização de perda de adesivos.
- "Faltou adesivo = Sim" força o destino da refação para **Arte** (via `VoltarDropdown` + validação no dialog).
- Nenhum arquivo do COP é tocado.
- Validações obrigatórias para as duas perguntas de adesivo quando `mostraAdesivos`.
