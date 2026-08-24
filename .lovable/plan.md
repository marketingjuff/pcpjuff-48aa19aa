# Corrigir erro de memória ao comprimir a foto do canhoto

Único arquivo tocado: `src/lib/entregas.ts`. Nenhuma migração, nenhum outro arquivo.

## O que muda

`comprimirFoto(file: File): Promise<Blob>` mantém a mesma assinatura e o mesmo
resultado (JPEG, lado maior até 1600px, qualidade 0.7), mas passa a ter três camadas:

1. **`createImageBitmap` com redimensionamento nativo** (`resizeWidth: 1600`,
   `resizeQuality: "medium"`) — o navegador decodifica já reduzido, sem alocar a
   resolução original inteira na RAM. Depois desenha no canvas no tamanho final e
   exporta JPEG 0.7. `bitmap.close()` em `finally` para liberar memória na hora.
2. **Fallback `Image` + canvas** — exatamente a lógica atual, movida para
   `comprimirViaImageElement`, usada só se a camada 1 não existir ou falhar.
3. **Último fallback** — se as duas falharem, devolve o `file` original sem
   compressão, para nunca bloquear a confirmação da entrega.

Constantes `MAX_LADO = 1600` e `QUALIDADE_JPEG = 0.7` no topo do bloco.

## Ao final

Rodo o typecheck e mostro o resultado.
