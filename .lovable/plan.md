# Estoque mínimo — OK e copiar/colar padrão

## Escopo
Alterar somente `src/components/plan/EstoqueMinimoTab.tsx`, após aprovação explícita. Sem migração, SQL, alterações de dados nesta preparação, novos arquivos de aplicação ou mudanças em `src/lib/plan.ts` e nos arquivos protegidos. O plano é apenas o registro obrigatório para aprovação.

## Alterações no arquivo autorizado

### 1. Campo Adotado
- Preservar salvamento ao sair do campo e por Enter, `maxLength`, filtro de dígitos e placeholder.
- Acrescentar botão **OK** à direita, somente para admin/gestor e quando o texto não estiver vazio e diferir do valor salvo.
- Usar `Button` outline, tamanho sm, `h-6`, texto de 11px e conjunto `flex items-center gap-1 justify-end`, sem reservar espaço para botão ausente.
- Interromper propagação no botão para não abrir o detalhe. Evitar que o clique em OK provoque duas gravações por também tirar o foco do input, mantendo o mesmo caminho de salvamento.
- Após sucesso, a atualização existente dos mínimos faz o botão desaparecer; erro continua no aviso atual.

### 2. Copiar padrão de uma cor
- Acrescentar **Copiar padrão** à direita da faixa de cor, somente para quem pode editar; a faixa passa a usar alinhamento flex entre cor e botão.
- Guardar em estado local `{ modelo, cor, valores: Map<tamanho, number> }`, usando os Adotados das linhas daquela cor presentes no card. Ignorar apenas valores nulos; zero é um valor válido.
- Sem valores adotados, não substituir o padrão existente e mostrar: “Essa cor ainda não tem nenhum mínimo adotado para copiar.”
- Mostrar abaixo dos filtros: “Padrão copiado de {modelo} {cor}, {n} tamanhos”, com **Limpar**. O padrão permanece após colagens e sai somente ao limpar ou recarregar a página.

### 3. Colar em um modelo inteiro
- Ao lado de **Aceitar todas deste modelo**, incluir **Colar padrão aqui**, outline/sm, somente para admin/gestor e desabilitado sem padrão.
- O clique não altera a abertura do card e abre um `AlertDialog` separado, preservando o diálogo de aceitação atual.
- Preparar o lote exclusivamente com as linhas do modelo destino em `blocos`, respeitando busca e “Mostrar só os defasados”. Aplicar em todas as cores visíveis, incluindo a origem quando for o mesmo modelo.
- Casar por tamanho, deixar tamanhos ausentes intocados e excluir valores já iguais. Contar as linhas efetivamente alteradas e as cores distintas dessas linhas.
- Título: “Colar o padrão de {modeloOrigem} {corOrigem} em {modeloDestino}?”
- Descrição: “{n} linhas vão passar a ter o mínimo adotado igual ao padrão copiado, em {c} cores. Tamanhos que não estão no padrão não mudam.”
- Botões **Cancelar** e **Colar**. Se não houver mudanças, não enviar gravação desnecessária.
- Usar `salvarLote` já existente com `{ modelo, cor, tamanho, minimo, sugerido: l.sugerido }`, mantendo o sugerido da linha de destino.
- Em falha, usar o aviso existente: “Não foi possível colar o padrão no modelo {modelo}: {mensagem}”. Em sucesso, aproveitar a atualização de consultas existente para refletir Adotado e Situação sem recarregar.
- Todos os botões novos interrompem propagação. Manter cabeçalhos e controles legíveis em telas estreitas.

## O que permanece igual
Cálculos de sugerido, defasagem, média e reposição; aceitação individual e por modelo; detalhe da conta; filtros; permissões existentes; fontes de dados e hooks.

## Verificação e entrega
- Exercitar os três caminhos de salvamento e conferir que OK não abre o detalhe nem duplica a gravação.
- Conferir cópia com nulos e zeros, aviso de padrão vazio, contagem, limpeza e persistência local entre colagens.
- Conferir correspondência por tamanho, exclusão de valores iguais, filtros, sugerido do destino e atualização após salvar; conferir controles ausentes em somente leitura.
- Testes de lógica, se necessários, ficam em `/tmp`, sem arquivos temporários no repositório. Não alterar valores reais de produção apenas para testar; eventuais limitações de verificação serão informadas.
- Conferir os resultados da compilação e checagem automática de tipos do ambiente. A execução manual de typecheck está proibida pelas instruções deste ambiente; informar essa limitação, sem apresentar compilação como typecheck manual.
- Entregar o resultado observado e o diff completo do único arquivo de aplicação autorizado, confirmando ausência de migração/SQL e alterações fora do escopo.