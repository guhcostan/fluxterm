import { useEffect, useRef } from 'react';
import { edgePath } from '../lib/dsl.js';

var MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
var BAR_W = 118;

function cut(s, n) {
  s = String(s === null || s === undefined ? '' : s);
  return s.length > n ? s.slice(0, n - 1) + '...' : s;
}

function lineColor(type, theme) {
  if (type === 'highlight') return theme.green;
  if (type === 'dim') return theme.dim;
  if (type === 'meta') return theme.muted;
  return theme.text;
}

function linePrefix(type) {
  if (type === 'highlight') return '>> ';
  if (type === 'bullet') return '- ';
  return '';
}

export default function DiagramCanvas(props) {
  var graph = props.graph;
  var theme = props.theme;
  var nodes = graph.nodes;
  var width = graph.width;
  var height = graph.height;
  var svgRef = useRef(null);
  var speed = props.speed || 1;
  var selectedId = props.selectedId;

  useEffect(function () {
    var svg = svgRef.current;
    if (!svg) return;
    try {
      if (props.playing) { if (svg.unpauseAnimations) svg.unpauseAnimations(); }
      else { if (svg.pauseAnimations) svg.pauseAnimations(); }
    } catch (err) { /* sem SMIL, segue o jogo */ }
  }, [props.playing]);

  var connected = {};
  if (selectedId) {
    connected[selectedId] = true;
    graph.edges.forEach(function (e) {
      if (e.from === selectedId) connected[e.to] = true;
      if (e.to === selectedId) connected[e.from] = true;
    });
  }

  var outCount = {}, inCount = {};
  graph.edges.forEach(function (e) {
    outCount[e.from] = (outCount[e.from] || 0) + 1;
    inCount[e.to] = (inCount[e.to] || 0) + 1;
  });

  var outSeen = {}, inSeen = {};
  var edgeEls = [];
  graph.edges.forEach(function (e, idx) {
    var a = graph.byId[e.from];
    var b = graph.byId[e.to];
    if (!a || !b) return;
    var oi = outSeen[e.from] || 0; outSeen[e.from] = oi + 1;
    var ii = inSeen[e.to] || 0; inSeen[e.to] = ii + 1;
    var ono = outCount[e.from] || 1, ino = inCount[e.to] || 1;
    var x1 = a.x + a.w, y1 = a.y + a.h / 2 + (oi - (ono - 1) / 2) * 14;
    var x2 = b.x, y2 = b.y + b.h / 2 + (ii - (ino - 1) / 2) * 14;
    var d = edgePath(x1, y1, x2, y2);
    var dim = selectedId && !(connected[e.from] && connected[e.to]);
    var dur = (5 / speed) + 's';
    var dur2 = (8.5 / speed) + 's';
    edgeEls.push(
      <g key={'e' + idx} opacity={dim ? 0.18 : 1}>
        <path d={d} fill="none" stroke={theme.edge} strokeWidth="1.4" strokeDasharray="6 6"
          markerEnd="url(#fx-arrow)" className="fx-edge"
          style={{ animationDuration: (1.4 / speed) + 's', animationPlayState: props.playing ? 'running' : 'paused' }} />
        {props.playing ? (
          <g>
            <circle r="3" fill={theme.accent} opacity="0.95">
              <animateMotion dur={dur} begin="0s" repeatCount="indefinite" path={d} />
            </circle>
            <circle r="1.8" fill={theme.green} opacity="0.9">
              <animateMotion dur={dur2} begin="-3s" repeatCount="indefinite" path={d} />
            </circle>
          </g>
        ) : null}
        {e.label ? (
          <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle"
            fontSize="10" fontFamily={MONO} fill={theme.dim}
            stroke={theme.canvasBg} strokeWidth="4" paintOrder="stroke">{cut(e.label, 26)}</text>
        ) : null}
      </g>
    );
  });

  function nodeEl(n, idx) {
    var dim = selectedId && !connected[n.id];
    var sel = selectedId === n.id;
    var top = n.sub ? 60 : 48;
    var cursor = top;
    var rows = [];
    var rk = 0;
    n.lines.forEach(function (l) {
      var k = 'r' + (rk++);
      if (l.type === 'divider') {
        rows.push(<line key={k} x1="14" x2={n.w - 14} y1={cursor + 2} y2={cursor + 2} stroke={theme.faint} strokeDasharray="2 4" />);
        cursor += 12;
      } else {
        rows.push(<text key={k} x="14" y={cursor + 11} fontSize="10.5" fontFamily={MONO} fill={lineColor(l.type, theme)}>{linePrefix(l.type) + cut(l.text, 36)}</text>);
        cursor += 17;
      }
    });
    n.bars.forEach(function (bb, bi) {
      var bw = Math.max(0, Math.min(1, bb.value)) * BAR_W;
      rows.push(
        <g key={'b' + bi}>
          <text x="14" y={cursor + 11} fontSize="10" fontFamily={MONO} fill={theme.muted}>{cut(bb.label, 20)}</text>
          <text x={14 + BAR_W + 30} y={cursor + 11} fontSize="10" fontFamily={MONO} fill={theme.dim}>{cut(bb.tag, 10)}</text>
          <rect x="14" y={cursor + 15} width={BAR_W + 22} height="7" rx="3.5" fill={theme.track} />
          <rect x="14" y={cursor + 15} width={Math.max(6, bw)} height="7" rx="3.5" fill={theme.green} />
        </g>
      );
      cursor += 30;
    });
    var statusEl = null;
    if (n.status) {
      var sc = n.status.kind === 'done' ? theme.green : (n.status.kind === 'idle' ? theme.dim : theme.amber);
      statusEl = (
        <g>
          <circle cx="20" cy={cursor + 8} r="3.5" fill={sc} className={n.status.kind === 'running' ? 'fx-blink' : ''} />
          <text x="30" y={cursor + 12} fontSize="10.5" fontFamily={MONO} fill={sc}>{cut(n.status.label, 22)}</text>
        </g>
      );
    }
    return (
      <g key={n.id} transform={'translate(' + n.x + ' ' + n.y + ')'} opacity={dim ? 0.28 : 1}
        className="fx-node" style={{ animationDelay: (idx * 70) + 'ms' }}
        onClick={function () { props.onSelect(n.id === selectedId ? null : n.id); }}>
        <rect x="0" y="0" width={n.w} height={n.h} rx="9" fill={theme.nodeBg}
          stroke={sel ? theme.accent : theme.nodeBorder} strokeWidth={sel ? 1.8 : 1.1}
          className={props.glow && !dim ? 'fx-glowrect' : ''} style={{ cursor: 'pointer' }} />
        <rect x="0" y="10" width="3" height={n.h - 20} rx="1.5" fill={theme.accent} opacity={sel ? 1 : 0.5} />
        <g clipPath={'url(#fxc-' + n.id + ')'}>
          <text x="14" y="24" fontSize="11.5" fontWeight="700" fontFamily={MONO} fill={theme.text} letterSpacing="0.6">{cut(n.title.toUpperCase(), 30)}</text>
          {n.sub ? <text x="14" y="40" fontSize="10" fontFamily={MONO} fill={theme.accent2}>{cut(n.sub, 38)}</text> : null}
          <line x1="14" x2={n.w - 14} y1={top - 10} y2={top - 10} stroke={theme.faint} strokeDasharray="2 4" />
          {rows}
          {statusEl}
        </g>
      </g>
    );
  }

  var dots = [];
  var p;
  for (p = 0; p < 14; p++) {
    dots.push(
      <span key={'p' + p} className="fx-mote" style={{
        left: ((p * 67 + 11) % 100) + '%',
        top: ((p * 41 + 23) % 100) + '%',
        animationDelay: (p * 0.7) + 's',
        animationDuration: (6 + (p % 5)) + 's',
        background: p % 3 === 0 ? theme.green : theme.accent
      }} />
    );
  }

  return (
    <div className="fx-wrap">
      <svg id="fluxterm-svg" ref={svgRef} width={width * props.zoom} height={height * props.zoom}
        viewBox={'0 0 ' + width + ' ' + height} className="fx-svg" role="img" aria-label="diagrama fluxterm">
        <defs>
          <pattern id="fx-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1.6" cy="1.6" r="1.3" fill={theme.dot} />
          </pattern>
          <marker id="fx-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill={theme.edgeStrong} />
          </marker>
          {nodes.map(function (n) {
            return <clipPath key={'c' + n.id} id={'fxc-' + n.id}><rect x="0" y="0" width={n.w} height={n.h} rx="9" /></clipPath>;
          })}
        </defs>
        <rect x="0" y="0" width={width} height={height} fill={theme.canvasBg} />
        {props.showGrid ? <rect x="0" y="0" width={width} height={height} fill="url(#fx-dots)" /> : null}
        <g>{edgeEls}</g>
        <g>{nodes.map(function (n, idx) { return nodeEl(n, idx); })}</g>
      </svg>
      {props.particles ? <div className="fx-particles">{dots}</div> : null}
    </div>
  );
}
