# Tela do motorista (/entregas): ver e trocar a foto do canhoto

Único arquivo tocado: `src/routes/_authenticated/entregas.tsx`. Zero SQL, zero migração, nenhuma dependência nova.

## 1. Imports
- `CanhotoFotoViewer` de `@/components/pcp/CanhotoFotoViewer` (só importar).
- Acrescentar `fotosDoPedido` ao import existente de `@/lib/entregas`.

## 2. Mutation `trocarFoto` (em `EntregasPage`)
Irmã da `confirmar`: chama `enviarFotoCanhoto(pedido, file)` e faz `update` gravando **somente** `canhoto_fotos`. Não toca em `entrega_confirmada_em` nem `entrega_confirmada_por`, e não navega no sucesso. Invalida `["entregas-pedidos"]` e `["pedidos"]`, toast "Foto do canhoto atualizada."; erro → toast com a mensagem.

## 3. Estado por pedido
`const [trocandoId, setTrocandoId] = useState<string | null>(null)` — setado antes do `mutate` e limpo no `onSettled`, para que só o botão do pedido em envio fique desabilitado.

## 4. `PedidoEntregaCard` — pedido já confirmado
Abaixo do badge "Entrega confirmada em …", uma linha `flex gap-2`:
- `CanhotoFotoViewer` com `label="Ver foto enviada"`, renderizado só quando `fotosDoPedido(pedido).length > 0`;
- botão "Trocar foto" (`variant="outline"`, ícone `Camera`, `h-11 flex-1`), que abre a câmera e chama `onTrocarFoto(file)`; enquanto envia mostra "Enviando foto…" e fica `disabled`.

Abaixo: `text-[11px] text-muted-foreground` com "A foto anterior é mantida no histórico — a mais recente é a que vale."

**Separação dos caminhos:** dois inputs `type="file"` distintos com refs próprios — `fileRef` (existente, só no caminho de confirmar, renderizado apenas quando não confirmado) e `trocaRef` novo (renderizado apenas no bloco de confirmado, `onChange` → `onTrocarFoto`). Assim é impossível o arquivo de troca cair no `onConfirmar`.

## 5. Props novas de `PedidoEntregaCard`
`onTrocarFoto?: (file: File) => void` e `trocando?: boolean`. Sem `onTrocarFoto`, o botão não aparece.

## 6. Lista "Entregues nos últimos 30 dias"
No `map` existente, segunda linha dentro do card com os mesmos dois controles: `CanhotoFotoViewer` (`label="Ver foto"`, só se houver foto) e "Trocar foto" chamando `trocarFoto` para aquele pedido, `disabled` quando `trocandoId === p.id`. Layout empilhado para não estourar ~390px.

## 7. Chamadas existentes
Passar `onTrocarFoto` e `trocando={trocandoId === p.id}` nas duas chamadas atuais (card `focado` do QR e cards de pendentes). Pedido não confirmado continua exatamente como hoje.

## 8. Fora do escopo
Nada de rota/dialog novo, nada no `ScannerQr`, nada em `pedidosPendentesEntrega`/`pedidosEntreguesRecentes`, nenhuma exclusão de foto, nenhuma lib nova.

Ao final: rodar o typecheck e mostrar o resultado.
