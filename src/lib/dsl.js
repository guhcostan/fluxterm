// fluxterm - parser e layout da DSL.
// Propositalmente simples para IAs gerarem sem erro.
// id [Titulo | Sub] + linhas, a -> b, log, bar, legend, title.

var LEGEND_COLORS = ['#7dd3fc', '#60a5fa', '#4ade80', '#c084fc', '#fbbf24', '#f472b6'];

export function slugId(raw, fallback) {
  var s = String(raw || '').toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  s = s.replace(/-{2,}/g, '-');
  if (!s) s = fallback || 'n1';
  return s;
}

function stripMarker(t) {
  return String(t || '').replace(/^[\u25C6\u25C7\u25A0\u25A1\u25CF\u25CB\u25C8\u25AA\u00B7\-\s]+/, '').trim();
}

export function parseDSL(src) {
  var text = String(src || '');
  var rawLines = text.split('\n');
  var nodes = [];
  var byId = {};
  var edges = [];
  var logs = [];
  var legend = [];
  var errors = [];
  var title = '';
  var current = null;
  var i, raw, t, ln;

  for (i = 0; i < rawLines.length; i++) {
    raw = rawLines[i];
    t = raw.trim();
    ln = i + 1;
    if (t === '' || t.charAt(0) === '#') continue;

    var mTitle = t.match(/^(?:title\s*:\s*|=\s*)(.+)$/i);
    if (mTitle) { title = mTitle[1].trim(); current = null; continue; }

    var mLegend = t.match(/^legend\s*:\s*(.+)$/i);
    if (mLegend) {
      var parts = mLegend[1].split('|');
      legend = [];
      for (var k = 0; k < parts.length; k++) {
        var label = stripMarker(parts[k].trim());
        if (label) legend.push({ label: label, color: LEGEND_COLORS[k % LEGEND_COLORS.length] });
      }
      current = null;
      continue;
    }

    var mLog = t.match(/^log\s+(.*)$/i);
    if (mLog) {
      var rest = mLog[1].trim();
      var mp = rest.match(/^(?:(\d{1,2}:\d{2}(?::\d{2})?)\s+)?(?:([A-Za-z0-9_@./-]+)\s+)?(.*)$/);
      logs.push({ time: (mp[1] || '').trim(), actor: (mp[2] || '').trim(), msg: (mp[3] || '').trim() });
      current = null;
      continue;
    }

    var mEdge = t.match(/^(?:edge\s+)?([A-Za-z0-9_-]+)\s*->\s*([A-Za-z0-9_-]+)(?:\s*:\s*(.+))?$/);
    if (mEdge) {
      edges.push({ from: mEdge[1], to: mEdge[2], label: (mEdge[3] || '').trim(), line: ln });
      current = null;
      continue;
    }

    var mNode = t.match(/^(?:node\s+)?([A-Za-z0-9_-]+)\s*\[(.+?)\]\s*$/);
    if (mNode) {
      var id = mNode[1];
      if (byId[id]) {
        errors.push('L' + ln + ': bloco "' + id + '" duplicado. Use outro id.');
        current = byId[id];
        continue;
      }
      var inner = mNode[2].split('|');
      var node = {
        id: id,
        title: (inner[0] || id).trim(),
        sub: (inner[1] || '').trim(),
        lines: [],
        bars: [],
        status: null,
        order: nodes.length
      };
      nodes.push(node);
      byId[id] = node;
      current = node;
      continue;
    }

    if (!current) {
      var hint = t.length > 30 ? t.slice(0, 30) + '...' : t;
      errors.push('L' + ln + ': "' + hint + '" esta fora de bloco. Abra um bloco com id [Titulo | Sub].');
      continue;
    }

    var bar = t.match(/^bar\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(%?)\s*(.*)$/);
    if (bar) {
      var num = parseFloat(bar[2].replace(',', '.'));
      var val = num;
      if (bar[3] === '%' || num > 1) val = num > 1 ? num / 100 : num;
      if (!(val >= 0)) val = 0;
      if (val > 1) val = 1;
      current.bars.push({ label: bar[1].trim(), value: val, tag: bar[4].trim() });
      continue;
    }

    if (/^---+/.test(t)) { current.lines.push({ type: 'divider' }); continue; }

    var run = t.match(/^[\u25CF\u25C9\u25CB]\s*(.+)$/);
    if (run) { current.status = { kind: 'running', label: run[1].trim() }; continue; }
    var done = t.match(/^[\u2713\u2714]\s*(.+)$/);
    if (done) { current.status = { kind: 'done', label: done[1].trim() }; continue; }

    var hi = t.match(/^(\u00BB|>>)\s*(.+)$/);
    if (hi) { current.lines.push({ type: 'highlight', text: hi[2].trim() }); continue; }

    var dim = t.match(/^!\s*(.+)$/);
    if (dim) { current.lines.push({ type: 'dim', text: dim[1].trim() }); continue; }

    var bul = t.match(/^[-\u2022\u25C7\u25E6\u25AA\u00B7]\s*(.+)$/);
    if (bul) { current.lines.push({ type: 'bullet', text: bul[1].trim() }); continue; }

    var meta = t.match(/^(calls|tokens|effort|latency|model|modelo|custo|tempo|status|threads|forks|split|sharp)\b[:\s]*(.*)$/i);
    if (meta) { current.lines.push({ type: 'meta', text: t }); continue; }

    var st = t.match(/^(running|done|idle|em espera|concluido|conclu\u00EDdo)$/i);
    if (st) {
      var w = st[1].toLowerCase();
      var kind = 'running';
      if (w === 'done' || w.indexOf('conclu') === 0) kind = 'done';
      else if (w === 'idle' || w.indexOf('espera') >= 0) kind = 'idle';
      current.status = { kind: kind, label: st[1] };
      continue;
    }

    current.lines.push({ type: 'text', text: t });
  }

  for (var e = 0; e < edges.length; e++) {
    var ed = edges[e];
    if (!byId[ed.from]) errors.push('L' + ed.line + ': origem "' + ed.from + '" nao existe como bloco.');
    if (!byId[ed.to]) errors.push('L' + ed.line + ': destino "' + ed.to + '" nao existe como bloco.');
  }

  return { title: title, legend: legend, nodes: nodes, edges: edges, logs: logs, errors: errors };
}

export function nodeHeight(n) {
  var h = 62;
  if (n.sub) h += 16;
  for (var i = 0; i < n.lines.length; i++) {
    if (n.lines[i].type === 'divider') h += 12;
    else h += 17;
  }
  h += n.bars.length * 27;
  if (n.status) h += 30;
  h += 14;
  if (h < 118) h = 118;
  if (h > 360) h = 360;
  return h;
}

export function layoutGraph(parsed) {
  var NODE_W = 236, GAP_X = 88, GAP_Y = 26, PAD_X = 44, PAD_TOP = 24;
  var nodes = parsed.nodes;
  var edges = parsed.edges;
  var depth = {}, hasIn = {}, adj = {};
  var i;
  for (i = 0; i < nodes.length; i++) {
    depth[nodes[i].id] = null;
    hasIn[nodes[i].id] = false;
    adj[nodes[i].id] = [];
  }
  for (i = 0; i < edges.length; i++) {
    var e = edges[i];
    if (adj[e.from]) adj[e.from].push(e.to);
    if (depth[e.to] !== undefined) hasIn[e.to] = true;
  }
  var queue = [];
  for (i = 0; i < nodes.length; i++) {
    if (!hasIn[nodes[i].id]) { depth[nodes[i].id] = 0; queue.push(nodes[i].id); }
  }
  var guard = 0;
  while (queue.length && guard < 5000) {
    guard++;
    var a = queue.shift();
    var outs = adj[a] || [];
    for (var k = 0; k < outs.length; k++) {
      var b = outs[k];
      if (depth[b] === null || depth[b] === undefined || depth[a] + 1 > depth[b]) {
        depth[b] = depth[a] + 1;
        queue.push(b);
      }
    }
  }
  var maxD = 0, key;
  for (key in depth) { if (depth[key] !== null && depth[key] !== undefined && depth[key] > maxD) maxD = depth[key]; }
  for (i = 0; i < nodes.length; i++) {
    if (depth[nodes[i].id] === null || depth[nodes[i].id] === undefined) { maxD++; depth[nodes[i].id] = maxD; }
  }
  var cols = {};
  var ncols = nodes.length ? maxD + 1 : 0;
  for (i = 0; i < nodes.length; i++) {
    var d = depth[nodes[i].id] || 0;
    if (!cols[d]) cols[d] = [];
    cols[d].push(nodes[i]);
  }
  var ck;
  for (ck in cols) cols[ck].sort(function (x, y) { return x.order - y.order; });
  var heights = {};
  for (i = 0; i < nodes.length; i++) heights[nodes[i].id] = nodeHeight(nodes[i]);
  var canvasH = 560, c2;
  for (c2 in cols) {
    var arr = cols[c2], tot = 0, q;
    for (q = 0; q < arr.length; q++) tot += heights[arr[q].id];
    tot += GAP_Y * (arr.length - 1);
    var need = tot + PAD_TOP * 2 + 60;
    if (need > canvasH) canvasH = need;
  }
  var placed = nodes.map(function (n) {
    var copy = {}, f;
    for (f in n) copy[f] = n[f];
    copy.h = heights[n.id];
    copy.w = NODE_W;
    return copy;
  });
  var byId2 = {};
  for (i = 0; i < placed.length; i++) byId2[placed[i].id] = placed[i];
  for (var d3 in cols) {
    var arr2 = cols[d3], tot2 = 0, q2, q3;
    for (q2 = 0; q2 < arr2.length; q2++) tot2 += heights[arr2[q2].id];
    tot2 += GAP_Y * (arr2.length - 1);
    var y = (canvasH - tot2) / 2;
    for (q3 = 0; q3 < arr2.length; q3++) {
      var nd = byId2[arr2[q3].id];
      nd.x = PAD_X + (+d3) * (NODE_W + GAP_X);
      nd.y = y;
      y += nd.h + GAP_Y;
    }
  }
  var width = ncols > 0 ? PAD_X * 2 + ncols * NODE_W + (ncols - 1) * GAP_X : 480;
  return { nodes: placed, edges: edges, width: width, height: canvasH, cols: ncols, byId: byId2 };
}

export function edgePath(x1, y1, x2, y2) {
  var dx = Math.abs(x2 - x1) * 0.5;
  if (dx < 28) dx = 28;
  return 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2;
}
