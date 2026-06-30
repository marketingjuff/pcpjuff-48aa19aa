## Objetivo
Ajustar o display de quantidades nos romaneios: o círculo/círculo principal deve mostrar o que **falta** (pendente), não o que já foi recebido. A razão `recebido/total` (ex: 60/100) deve ser padrão em toda a tela de romaneio.

## Alterações

### 1. `src/components/cop/EntregaRomaneioDialog.tsx`
- **Círculo principal**: alterar de `r` (recebido) para `falta = qtd - r`.
  - Não iniciado: `falta = qtd` (mantém 100).
  - Parcial: `falta = 40` (em vez de 60).
  - Completo: `falta = 0` (em vez de 100).
- **Texto abaixo do círculo**: ajustar de `falta {falta}` para `recebido {r}` (para evitar redundância com o círculo agora mostrando falta).
- **Razão inferior**: já exibe `r/qtd`; manter.

### 2. `src/components/cop/RomaneioTab.tsx` (tabela de conferência read-only)
- **Badges de quantidade**: hoje mostram `qtd · r` (ex: 100 · 60). Alterar para o padrão `r/qtd` (ex: 60/100), conforme solicitado.
- Aplicar o mesmo conceito visual: o número principal do badge deve refletir o que está pendente (`falta`), e a razão deve mostrar progresso.

### 3. Verificação
- Conferir se há outros componentes COP/romaneio com display similar de quantidades por tamanho (ex: PDF, outras abas) e aplicar o mesmo padrão `r/qtd` quando relevante.
- Testar visualmente os três estados: não iniciado, parcial e completo.

## Nota técnica
A variável `falta = qtd - r` já existe no componente (`EntregaRomaneioDialog.tsx`). Apenas o conteúdo do círculo e o texto abaixo serão trocados. O padrão `recebido/total` será propagado para o badge da tabela read-only do `RomaneioTab.tsx`.