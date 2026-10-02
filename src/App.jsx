import { useEffect, useMemo, useRef, useState } from 'react';
import { parseDSL, layoutGraph } from './lib/dsl.js';
import { generateFromPrompt, SYSTEM_PROMPT } from './lib/generate.js';
import { EXAMPLES } from './lib/examples.js';
import DiagramCanvas from './components/DiagramCanvas.jsx';

var THEMES = {
  astra: {
    name: 'Astra neon', desc: 'O estilo do print.',
    canvasBg: '#080d18', dot: 'rgba(148,163,184,0.20)',
    edge: 'rgba(148,163,184,0.55)', edgeStrong: '#8fa2b8',
    nodeBg: '#0c1324', nodeBorder: 'rgba(125,211,252,0.42)',
    accent: '#7dd3fc', accent2: '#60a5fa', green: '#4ade80', amber: '#fbbf24', purple: '#c084fc',
    text: '#e6edf6', muted: '#93a1b5', dim: '#5f6f84',
    faint: 'rgba(148,163,184,0.22)', track: 'rgba(148,163,184,0.18)'
  },
  sol: {
    name: 'Sol amber', desc: 'Quente, clima de deploy.',
    canvasBg: '#0d0b08', dot: 'rgba(251,191,36,0.14)',
    edge: 'rgba(214,178,132,0.50)', edgeStrong: '#d8b284',
    nodeBg: '#141008', nodeBorder: 'rgba(251,191,36,0.38)',
    accent: '#fbbf24', accent2: '#fb923c', green: '#4ade80', amber: '#fbbf24', purple: '#e879a0',
    text: '#f2ead9', muted: '#b3a284', dim: '#7a6c52',
    faint: 'rgba(251,191,36,0.18)', track: 'rgba(251,191,36,0.16)'
  },
  ghost: {
    name: 'Ghost green', desc: 'Fosforo de terminal raiz.',
    canvasBg: '#050805', dot: 'rgba(74,222,128,0.13)',
    edge: 'rgba(134,239,172,0.45)', edgeStrong: '#86efac',
    nodeBg: '#071007', nodeBorder: 'rgba(74,222,128,0.36)',
    accent: '#4ade80', accent2: '#86efac', green: '#4ade80', amber: '#fbbf24', purple: '#7dd3fc',
    text: '#d9f5e3', muted: '#8fb89e', dim: '#55705f',
    faint: 'rgba(74,222,128,0.18)', track: 'rgba(74,222,128,0.16)'
  }
};

var CHEAT = [
  'title: Nome do diagrama',
  'legend: contexto a | contexto b',
  '',
  'meu-id [Titulo Visivel | subtitulo curto]',
  '  contexto em uma linha',
  '  - detalhe em bala',
  '  \u00BB destaque verde',
  '  bar confianca 0.82 alto',
  '  calls 3',
  '  ---',
  '  \u25CF running     (ou \u2713 done)',
  '',
  'meu-id -> outro-id : rotulo da seta',
  'log 10:00 ator fez algo -> tag'
].join('\n');

function actorColor(actor, theme) {
  var s = String(actor || 'sys');
  var h = 0;
  for (var i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % 997;
  var arr = [theme.accent, theme.green, theme.purple, theme.amber];
  return arr[h % arr.length];
}

function download(name, content, mime) {
  var blob = new Blob([content], { type: mime });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
}

function encodeHash(dsl) {
  try { return '#d=' + btoa(unescape(encodeURIComponent(dsl))); }
  catch (e) { return ''; }
}

function decodeHash() {
  try {
    var h = window.location.hash;
    if (h && h.indexOf('#d=') === 0) return decodeURIComponent(escape(atob(h.slice(3))));
  } catch (e) { /* hash invalido, segue o exemplo */ }
  return '';
}

function fallbackCopy(str) {
  var ta = document.createElement('textarea');
  ta.value = str;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* clipboard bloqueado */ }
  document.body.removeChild(ta);
}

export default function App() {
  var first = useMemo(function () { return decodeHash() || EXAMPLES[0].dsl; }, []);
  var prompt0 = '';
  var _init = [first, prompt0];

  var dslState = useState(_init[0]);
  var dsl = dslState[0], setDsl = dslState[1];
  var promptState = useState('');
  var prompt = promptState[0], setPrompt = promptState[1];
  var noteState = useState('Descreva o sistema ou cole uma cadeia tipo login -> api -> banco.');
  var note = noteState[0], setNote = noteState[1];
  var tabState = useState('ia');
  var tab = tabState[0], setTab = tabState[1];
  var themeState = useState('astra');
  var themeId = themeState[0], setThemeId = themeState[1];
  var playState = useState(true);
  var playing = playState[0], setPlaying = playState[1];
  var speedState = useState(1);
  var speed = speedState[0], setSpeed = speedState[1];
  var gridState = useState(true);
  var showGrid = gridState[0], setShowGrid = gridState[1];
  var glowState = useState(true);
  var glow = glowState[0], setGlow = glowState[1];
  var motesState = useState(true);
  var particles = motesState[0], setParticles = motesState[1];
  var logState = useState(true);
  var showLog = logState[0], setShowLog = logState[1];
  var selState = useState(null);
  var selectedId = selState[0], setSelectedId = selState[1];
  var zoomState = useState(1);
  var zoom = zoomState[0], setZoom = zoomState[1];
  var shownState = useState(4);
  var shown = shownState[0], setShown = shownState[1];
  var toastState = useState('');
  var toast = toastState[0], setToast = toastState[1];
  var sysState = useState(false);
  var showSys = sysState[0], setShowSys = sysState[1];
  var toastTimer = useRef(null);
  var logBox = useRef(null);

  var theme = THEMES[themeId] || THEMES.astra;
  var parsed = useMemo(function () { return parseDSL(dsl); }, [dsl]);
  var graph = useMemo(function () { return layoutGraph(parsed); }, [parsed]);

  var autoLogs = useMemo(function () {
    if (parsed.logs.length) return parsed.logs;
    return graph.edges.slice(0, 8).map(function (e) {
      return { time: '', actor: e.from, msg: e.from + ' -> ' + e.to + (e.label ? ' \u00B7 ' + e.label : ''), tag: 'fluxo' };
    });
  }, [parsed, graph]);

  useEffect(function () { setShown(4); setSelectedId(null); }, [dsl]);

  useEffect(function () {
    if (!playing || !showLog) return undefined;
    if (shown >= autoLogs.length) return undefined;
    var t = setInterval(function () {
      setShown(function (s) { return Math.min(s + 1, autoLogs.length); });
    }, Math.max(500, 1500 / speed));
    return function () { clearInterval(t); };
  }, [playing, showLog, shown, autoLogs.length, speed]);

  useEffect(function () {
    var el = logBox.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, showLog]);

  function say(msg) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(function () { setToast(''); }, 2600);
  }

  function copyText(str, msg) {
    var done = function () { say(msg); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(done, function () { fallbackCopy(str); done(); });
    } else { fallbackCopy(str); done(); }
  }

  function gerarIA() {
    if (!prompt.trim()) { say('Descreva o sistema primeiro.'); return; }
    var out = generateFromPrompt(prompt);
    if (!out.dsl) { say('Nao entendi. Tente "login -> api -> banco".'); return; }
    setDsl(out.dsl);
    setNote(out.note);
    say('Diagrama gerado. Ajuste na aba DSL se quiser.');
  }

  function aplicarExemplo(id) {
    for (var i = 0; i < EXAMPLES.length; i++) {
      if (EXAMPLES[i].id === id) {
        setDsl(EXAMPLES[i].dsl);
        setNote(EXAMPLES[i].desc);
        say('Exemplo aplicado: ' + EXAMPLES[i].name + '.');
        return;
      }
    }
  }

  function baixarSVG() {
    var el = document.getElementById('fluxterm-svg');
    if (!el) { say('Canvas ainda nao renderizou.'); return; }
    var clone = el.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    var st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    st.textContent = '.fx-edge{stroke-dasharray:6 6;} text{font-family:monospace;}';
    clone.insertBefore(st, clone.firstChild);
    var src = new XMLSerializer().serializeToString(clone);
    download('fluxterm.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + src, 'image/svg+xml');
    say('SVG baixado.');
  }

  function baixarPNG() {
    var el = document.getElementById('fluxterm-svg');
    if (!el) { say('Canvas ainda nao renderizou.'); return; }
    var clone = el.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    var src = new XMLSerializer().serializeToString(clone);
    var url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml;charset=utf-8' }));
    var img = new Image();
    img.onload = function () {
      var scale = 2;
      var cv = document.createElement('canvas');
      cv.width = Math.max(2, Math.round(graph.width * scale));
      cv.height = Math.max(2, Math.round(graph.height * scale));
      var ctx = cv.getContext('2d');
      ctx.fillStyle = theme.canvasBg;
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(function (b) {
        if (!b) { say('Falha no PNG. Tente o SVG.'); return; }
        var u2 = URL.createObjectURL(b);
        var a = document.createElement('a');
        a.href = u2;
        a.download = 'fluxterm.png';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(u2); }, 400);
        say('PNG baixado.');
      }, 'image/png');
    };
    img.onerror = function () { URL.revokeObjectURL(url); say('Falha no PNG. Tente o SVG.'); };
    img.src = url;
  }

  function copiarLink() {
    var h = encodeHash(dsl);
    var url = window.location.href.split('#')[0] + h;
    try { window.location.hash = h; } catch (e) { /* sem hash, segue */ }
    copyText(url, 'Link copiado. O diagrama viaja na URL.');
  }

  function zoomBy(delta) {
    setZoom(function (z) {
      var nz = Math.round((z + delta) * 100) / 100;
      if (nz < 0.4) nz = 0.4;
      if (nz > 2) nz = 2;
      return nz;
    });
  }

  var visibleLogs = autoLogs.slice(0, shown).slice(-14);
  var selNode = (selectedId && graph.byId) ? (graph.byId[selectedId] || null) : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark" />
          <div>
            <div className="brand-name">fluxterm</div>
            <div className="brand-sub">diagramas vivos estilo terminal, feitos p/ IA</div>
          </div>
        </div>
        <div className="top-actions">
          <button className="btn" onClick={function () { copyText(dsl, 'DSL copiada. Cole em qualquer LLM.'); }}>Copiar DSL</button>
          <button className="btn" onClick={baixarSVG}>SVG</button>
          <button className="btn" onClick={baixarPNG}>PNG</button>
          <button className="btn primary" onClick={copiarLink}>Copiar link</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="tabs">
            <button className={tab === 'ia' ? 'tab on' : 'tab'} onClick={function () { setTab('ia'); }}>IA</button>
            <button className={tab === 'dsl' ? 'tab on' : 'tab'} onClick={function () { setTab('dsl'); }}>
              DSL{parsed.errors.length ? <span className="err-n">{parsed.errors.length}</span> : null}
            </button>
            <button className={tab === 'estilo' ? 'tab on' : 'tab'} onClick={function () { setTab('estilo'); }}>Estilo</button>
          </div>

          {tab === 'ia' ? (
            <div className="pane">
              <label className="lbl">Descreva o sistema</label>
              <textarea className="prompt" value={prompt}
                onChange={function (ev) { setPrompt(ev.target.value); }}
                placeholder="Ex: login social -> bff -> api auth -> sessao redis" />
              <button className="btn primary big" onClick={gerarIA}>Gerar diagrama</button>
              <div className="note">{note}</div>
              <div className="lbl">Exemplos</div>
              <div className="chips">
                {EXAMPLES.map(function (ex) {
                  return <button key={ex.id} className="chip" title={ex.desc} onClick={function () { aplicarExemplo(ex.id); }}>{ex.name}</button>;
                })}
              </div>
              <div className="lbl">Trazer de outro chat de IA</div>
              <p className="hint">Cole o prompt de sistema no ChatGPT ou Claude e cole a resposta na aba DSL.</p>
              <button className="btn" onClick={function () { setShowSys(!showSys); }}>{showSys ? 'Esconder prompt' : 'Ver prompt de sistema'}</button>
              {showSys ? (
                <div className="sysbox">
                  <pre>{SYSTEM_PROMPT}</pre>
                  <button className="btn" onClick={function () { copyText(SYSTEM_PROMPT, 'Prompt de sistema copiado.'); }}>Copiar prompt</button>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === 'dsl' ? (
            <div className="pane">
              <label className="lbl">DSL, edicao ao vivo</label>
              <textarea className="dsl" value={dsl} spellCheck="false"
                onChange={function (ev) { setDsl(ev.target.value); }} />
              <div className="stats">{parsed.nodes.length} blocos {'\u00B7'} {parsed.edges.length} setas {'\u00B7'} {parsed.logs.length} logs</div>
              {parsed.errors.length ? (
                <ul className="errs">{parsed.errors.slice(0, 6).map(function (er, i) { return <li key={i}>{er}</li>; })}</ul>
              ) : <div className="okmsg">DSL valida. Tudo certo.</div>}
            </div>
          ) : null}

          {tab === 'estilo' ? (
            <div className="pane">
              <label className="lbl">Tema</label>
              <div className="themes">
                {Object.keys(THEMES).map(function (k) {
                  var th = THEMES[k];
                  return (
                    <button key={k} className={k === themeId ? 'theme on' : 'theme'} onClick={function () { setThemeId(k); }}>
                      <span className="sw" style={{ background: th.accent }} />
                      <span className="sw" style={{ background: th.green }} />
                      <span className="sw" style={{ background: th.accent2 }} />
                      <span className="tname">{th.name}</span>
                      <span className="tdesc">{th.desc}</span>
                    </button>
                  );
                })}
              </div>
              <label className="lbl">Velocidade {'\u00B7'} {speed}x</label>
              <input type="range" min="0.5" max="2.5" step="0.5" value={speed}
                onChange={function (ev) { setSpeed(parseFloat(ev.target.value)); }} />
              <label className="switch"><input type="checkbox" checked={playing} onChange={function (ev) { setPlaying(ev.target.checked); }} /><span>Animacao ligada</span></label>
              <label className="switch"><input type="checkbox" checked={showGrid} onChange={function (ev) { setShowGrid(ev.target.checked); }} /><span>Grade pontilhada</span></label>
              <label className="switch"><input type="checkbox" checked={glow} onChange={function (ev) { setGlow(ev.target.checked); }} /><span>Brilho neon</span></label>
              <label className="switch"><input type="checkbox" checked={particles} onChange={function (ev) { setParticles(ev.target.checked); }} /><span>Particulas</span></label>
              <label className="switch"><input type="checkbox" checked={showLog} onChange={function (ev) { setShowLog(ev.target.checked); }} /><span>Log de sessao</span></label>
            </div>
          ) : null}
        </aside>

        <main className="stage">
          <div className="stagebar">
            <div className="legend">
              {parsed.legend.length ? parsed.legend.map(function (lg, i) {
                return <span key={i} className="leg"><span className="dia" style={{ background: lg.color }} />{lg.label}</span>;
              }) : <span className="legend-empty">sem legenda, adicione legend: a | b</span>}
            </div>
            <div className="controls">
              <button className="btn sm" onClick={function () { setPlaying(!playing); }}>{playing ? 'Pausar' : 'Animar'}</button>
              <button className="btn sm" onClick={function () { zoomBy(-0.1); }}>-</button>
              <span className="zoomv">{Math.round(zoom * 100)}%</span>
              <button className="btn sm" onClick={function () { zoomBy(0.1); }}>+</button>
              <button className="btn sm" onClick={function () { setZoom(1); }}>Ajustar</button>
            </div>
          </div>
          <div className="titleline">{parsed.title || 'sem titulo, adicione title: ...'}</div>
          <div className="canvas-scroll">
            <DiagramCanvas graph={graph} theme={theme} playing={playing} speed={speed}
              glow={glow} showGrid={showGrid} particles={particles}
              selectedId={selectedId} onSelect={setSelectedId} zoom={zoom} />
          </div>
          {showLog ? (
            <div className="logstrip">
              <div className="loghead">session log</div>
              <div className="logbody" ref={logBox}>
                {visibleLogs.map(function (lg, i) {
                  return (
                    <div key={i} className="logline">
                      <span className="lt">{lg.time || '--:--'}</span>
                      <span className="la" style={{ color: actorColor(lg.actor, theme) }}>{lg.actor || 'sys'}</span>
                      <span className="lm">{lg.msg}</span>
                    </div>
                  );
                })}
                {shown < autoLogs.length ? <div className="logline dim">recebendo eventos...</div> : null}
              </div>
            </div>
          ) : null}
          {selNode ? (
            <div className="inspector">
              <button className="x" onClick={function () { setSelectedId(null); }}>x</button>
              <div className="ins-title">{selNode.title}</div>
              {selNode.sub ? <div className="ins-sub">{selNode.sub}</div> : null}
              <div className="ins-meta">{selNode.lines.length} linhas {'\u00B7'} {selNode.bars.length} barras</div>
              {selNode.status ? <div className="ins-status">{selNode.status.label}</div> : null}
            </div>
          ) : null}
        </main>
      </div>

      <footer className="help">
        <details>
          <summary>Como escrever a DSL (30 segundos)</summary>
          <pre>{CHEAT}</pre>
        </details>
        <span className="foot">fluxterm {'\u00B7'} diagramas vivos estilo terminal</span>
      </footer>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
