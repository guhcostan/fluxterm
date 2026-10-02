# fluxterm

Diagramas vivos em estilo terminal, feitos para IA gerar. Pense num mermaid, mas mais bonito, com animacao — e com uma sintaxe que qualquer LLM acerta de primeira.

Inspirado naquele print do agent tree (ASTRA on call, Sol, forks JEV): fundo escuro pontilhado, caixas neon em monospace, setas animadas com particulas, barrinhas de confianca e log de sessao digitando embaixo.

## Rodar

```sh
npm install
npm run dev
```

Build de producao: `npm run build` (vira `dist/`, estatico, pode hospedar em qualquer lugar).

## A DSL (30 segundos)

```text
title: Nome do diagrama
legend: contexto a | contexto b

meu-id [Titulo Visivel | subtitulo curto]
  contexto em uma linha
  - detalhe em bala
  >> destaque verde
  bar confianca 0.82 alto
  calls 3
  ---
  * running     (ou ok done)

meu-id -> outro-id : rotulo da seta
log 10:00 ator fez algo -> tag
```

Regras que a IA precisa seguir (estao no prompt de sistema dentro do app):

- ids em minusculo com hifen, sem espacos
- 4 a 8 blocos, encadeados com `->`, no maximo 1 bifurcacao
- cada bloco: 2 a 6 linhas, no maximo 3 barras (valor 0 a 1)
- todo id citado em `->` precisa existir como bloco

## Gerar com IA

1. Aba **IA**: descreva o sistema ou cole uma cadeia tipo `login -> api -> banco` e clique em gerar. Funciona offline, sem chave.
2. De outro chat: abra o **prompt de sistema** na aba IA, cole no ChatGPT/Claude, e cole a resposta na aba **DSL**.

## Exportar

Copiar DSL, baixar SVG/PNG e copiar link (o diagrama viaja compactado na URL, da pra compartilhar).

## Temas

Astra neon (o do print), Sol amber e Ghost green. Velocidade, grade, brilho, particulas e log sao ajustaveis na aba Estilo.

