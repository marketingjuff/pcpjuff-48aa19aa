# Cadastrar áreas de fora e problemas de perda

## O que muda
- "Área de fora da Juff que errou": Tecido e Costura.
- Problemas de Tecido: Barramento, Mancha de tingimento, Tecido desfiado, Defeito do tecido, Emenda.
- Problemas de Costura: Pique, Peça descosturada, Volta para conserto.
- Problemas de Produção: Erro de corte, Peça estampada indevidamente.

## Como
- Uma migração nova só com os 4 INSERTs do seu arquivo, exatamente como escritos, todos com ON CONFLICT DO NOTHING.
- Nada de DROP/DELETE/UPDATE/ALTER; nenhum arquivo de src/ tocado.
- Antes: conferir (só leitura) que a área Produção com aquele id existe.
- Ao final: diff completo e resultado da consulta de conferência.
