// fluxterm - geracao local a partir de pedido em linguagem natural.
// Heuristica sem rede: detecta cadeia, pipeline, api ou arvore de agentes.
// O prompt de sistema permite gerar a DSL em qualquer LLM externo.

import { slugId } from './dsl.js';

export var SYSTEM_PROMPT = [
  'Voce gera diagramas fluxterm.',
  'Responda SOMENTE com codigo fluxterm valido, sem cercas de codigo.',
  '',
  'Sintaxe:',
  'title: Titulo do diagrama',
  'legend: rotulo um | rotulo dois | rotulo tres',
  '',
  'id-unico [Titulo Visivel | subtitulo curto]',
  '  linha de contexto curta',
  '  - detalhe em bala',
  '  \u00BB destaque verde (decisao, arquivo, numero)',
  '  bar rotulo 0.78 tag opcional',
  '  calls 3',
  '  ---',
  '  \u25CF running   ou   \u2713 done',
  '',
  'origem -> destino : rotulo opcional da seta',
  'log 23:48:12 ator mensagem curta -> tag',
  '',
  'Regras:',
  '- ids em minusculo com hifen, sem espacos.',
  '- 4 a 8 blocos, encadeados com -> e no maximo 1 bifurcacao.',
  '- cada bloco: 2 a 6 linhas, no maximo 3 barras.',
  '- barras usam valor de 0 a 1.',
  '- texto curto, sem emoji.',
  '- todo id citado em -> precisa existir como bloco.'
].join('\n');

function hasAny(low, words) {
  for (var i = 0; i < words.length; i++) {
    if (low.indexOf(words[i]) >= 0) return true;
  }
  return false;
}

function cleanStep(s) {
  var t = String(s || '').trim().replace(/^[\-\u2022\d.\)\s]+/, '').trim();
  if (t.length > 34) t = t.slice(0, 33).trim();
  return t;
}

function extractChain(prompt) {
  var parts = String(prompt || '').split(/\s*(?:->|\u2192|=>)\s*/);
  if (parts.length >= 3) {
    var steps = [];
    for (var i = 0; i < parts.length; i++) {
      var c = cleanStep(parts[i]);
      if (c) steps.push(c);
    }
    if (steps.length >= 3 && steps.length <= 9) return steps;
  }
  var items = String(prompt || '').split(/[\n,;]+/);
  var cleaned = [], j;
  for (j = 0; j < items.length; j++) {
    var s2 = cleanStep(items[j]);
    if (s2 && s2.length > 2) cleaned.push(s2);
  }
  if (cleaned.length >= 3 && cleaned.length <= 7 && String(prompt).length < 260) return cleaned;
  return null;
}

function uniqueIds(names) {
  var seen = {}, out = [];
  for (var i = 0; i < names.length; i++) {
    var base = slugId(names[i], 'etapa-' + (i + 1));
    var id = base, n = 2;
    while (seen[id]) { id = base + '-' + n; n++; }
    seen[id] = true;
    out.push(id);
  }
  return out;
}

function chainDSL(topic, steps) {
  var ids = uniqueIds(steps);
  var L = [];
  L.push('title: ' + topic.slice(0, 64));
  L.push('legend: fluxo \u00B7 ' + steps.length + ' etapas');
  L.push('');
  var i;
  for (i = 0; i < steps.length; i++) {
    L.push(ids[i] + ' [' + steps[i] + ' | etapa ' + (i + 1) + ' de ' + steps.length + ']');
    if (i === 0) {
      L.push('  \u00BB inicio do fluxo');
      L.push('  pedido: ' + topic.slice(0, 42));
    } else if (i === steps.length - 1) {
      L.push('  \u00BB fim do fluxo');
      L.push('  \u2713 entregue');
    } else {
      L.push('  \u00BB passo ' + (i + 1));
      L.push('  recebe anterior \u00B7 libera proxima');
    }
    L.push('');
  }
  for (i = 0; i < ids.length - 1; i++) {
    L.push(ids[i] + ' -> ' + ids[i + 1] + (i === 0 ? ' : comeca aqui' : ''));
  }
  L.push('');
  for (i = 0; i < ids.length; i++) {
    L.push('log sys ' + ids[i] + ' pronto -> fluxo');
  }
  return L.join('\n');
}

function agentDSL(topic) {
  var L = [];
  L.push('title: ' + topic.slice(0, 48) + ' \u00B7 agent tree');
  L.push('legend: planeja | executa | revisa');
  L.push('');
  L.push('nucleo [nucleo \u00B7 main | planeja + escreve codigo]');
  L.push('  effort alto');
  L.push('  \u00BB divide em PRs pequenas');
  L.push('');
  L.push('tri [triagem | fork layer]');
  L.push('  bar qual arquivo 0.82 preciso');
  L.push('  bar qual ferramenta 0.95 preciso');
  L.push('  bar tentar ou parar 0.88 afiado');
  L.push('');
  L.push('dev [dev | edita + testa]');
  L.push('  \u25CF running');
  L.push('');
  L.push('leitor [leitor | le o codigo]');
  L.push('  \u2713 done');
  L.push('');
  L.push('docs [docs | puxa a documentacao]');
  L.push('  \u25CF running');
  L.push('');
  L.push('volta [volta ao nucleo | revisa + verifica]');
  L.push('  auto_review aprova e mescla');
  L.push('');
  L.push('nucleo -> tri : antes do plano');
  L.push('tri -> dev');
  L.push('tri -> leitor');
  L.push('tri -> docs');
  L.push('dev -> volta');
  L.push('leitor -> volta');
  L.push('docs -> volta');
  L.push('');
  L.push('log sys triagem distribuida -> agentes');
  L.push('log dev testes locais passando -> codigo');
  L.push('log leitor 23 arquivos lidos -> codigo');
  return L.join('\n');
}

function pipelineDSL(topic) {
  var L = [];
  L.push('title: ' + topic.slice(0, 48) + ' \u00B7 deploy pipeline');
  L.push('legend: build \u00B7 test | review \u00B7 humano | deploy \u00B7 auto');
  L.push('');
  L.push('codigo [push main | commit do dia]');
  L.push('  \u00BB diff enxuto, pronto p/ CI');
  L.push('  \u2713 done');
  L.push('');
  L.push('ci [build | ci em 2 min]');
  L.push('  bar testes unit 0.94 ok');
  L.push('  bar lint 0.88 ok');
  L.push('  \u2713 done');
  L.push('');
  L.push('e2e [e2e staging | casos criticos]');
  L.push('  bar checkout 0.96 ok');
  L.push('  bar reembolso 0.81 flaky');
  L.push('  \u25CF running');
  L.push('');
  L.push('revisao [revisao | humana]');
  L.push('  \u00BB 2 comentarios abertos');
  L.push('  em espera');
  L.push('');
  L.push('prod [deploy prod | canario 10%]');
  L.push('  bar canario 0.10 live');
  L.push('  bar erro 0.02 ok');
  L.push('  \u25CF running');
  L.push('');
  L.push('codigo -> ci');
  L.push('ci -> e2e');
  L.push('e2e -> revisao : promotor');
  L.push('revisao -> prod : aprovada');
  L.push('');
  L.push('log ci build verde em 2m04 -> pipeline');
  L.push('log e2e reembolso flaky, retry 1 vez -> staging');
  return L.join('\n');
}

function systemDSL(topic) {
  var L = [];
  L.push('title: ' + topic.slice(0, 48) + ' \u00B7 auth flow');
  L.push('legend: cliente | borda | servico');
  L.push('');
  L.push('app [app | tela login]');
  L.push('  \u00BB entra com Apple');
  L.push('  \u2713 done');
  L.push('');
  L.push('borda [edge bff | valida + roteia]');
  L.push('  bar latencia p95 0.42 380ms');
  L.push('  \u2713 done');
  L.push('');
  L.push('api [api auth | sessao + jwt]');
  L.push('  bar login ok 0.99 pico');
  L.push('  bar refresh 0.87 ok');
  L.push('  \u25CF running');
  L.push('');
  L.push('idp [Apple idP | fora do backend]');
  L.push('  \u00BB fallback: Google');
  L.push('  \u2713 done');
  L.push('');
  L.push('sessao [sessao | redis + cookie]');
  L.push('  tempo 14 dias \u00B7 httpOnly');
  L.push('  \u00BB gira a cada refresh');
  L.push('  \u2713 done');
  L.push('');
  L.push('app -> borda');
  L.push('borda -> api');
  L.push('api -> idp : desafio');
  L.push('idp -> sessao : codigo valido');
  L.push('api -> sessao : direto');
  L.push('');
  L.push('log api login ok p99 410ms -> borda');
  L.push('log idp fallback Google ativo -> login');
  return L.join('\n');
}

export function generateFromPrompt(rawPrompt) {
  var prompt = String(rawPrompt || '').trim();
  if (!prompt) return { dsl: '', note: 'empty' };
  var low = prompt.toLowerCase();
  var topic = prompt.split('\n')[0].slice(0, 64).trim() || 'Meu sistema';
  var chain = extractChain(prompt);
  if (chain) return { dsl: chainDSL(topic, chain), note: 'Cadeia detectada: ' + chain.length + ' etapas viraram blocos.' };
  if (hasAny(low, ['deploy', 'publicar', 'pipeline', 'build', 'release', 'ci ', 'cd '])) {
    return { dsl: pipelineDSL(topic), note: 'Pipeline de deploy gerado a partir do pedido.' };
  }
  if (hasAny(low, ['api', 'auth', 'login', 'endpoint', 'banco', 'cache', 'sess'])) {
    return { dsl: systemDSL(topic), note: 'Arquitetura de autenticacao gerada a partir do pedido.' };
  }
  return { dsl: agentDSL(topic), note: 'Arvore de agentes gerada a partir do pedido.' };
}
