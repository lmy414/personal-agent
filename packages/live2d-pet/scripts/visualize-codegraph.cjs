// Generate an interactive D3 force-directed graph visualization from CodeGraph SQLite data
// Usage: node --experimental-sqlite scripts/visualize-codegraph.cjs && start scripts/codegraph-viz.html

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', '.codegraph', 'codegraph.db');
const outPath = path.resolve(__dirname, 'codegraph-viz.html');

const db = new DatabaseSync(dbPath, { readonly: true });

// Fetch all nodes
const nodes = db.prepare(`
  SELECT id, kind, name, qualified_name, file_path, language, start_line
  FROM nodes
  ORDER BY
    CASE kind WHEN 'file' THEN 0 WHEN 'function' THEN 1 WHEN 'interface' THEN 2
              WHEN 'type_alias' THEN 3 WHEN 'constant' THEN 4
              WHEN 'variable' THEN 5 WHEN 'import' THEN 6 ELSE 7 END,
    name
`).all();

// Fetch all edges
const edges = db.prepare(`SELECT source, target, kind FROM edges`).all();

db.close();

// Color map for node kinds
const colorMap = {
  file: '#6C5CE7',
  function: '#00B894',
  interface: '#0984E3',
  type_alias: '#636E72',
  constant: '#FDCB6E',
  variable: '#E17055',
  import: '#B2BEC3',
  property: '#FD79A8',
};

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CodeGraph — live2d-mcp</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f14; color: #e0e0e0; overflow: hidden; }
  #graph { width: 100vw; height: 100vh; }
  #panel {
    position: absolute; top: 12px; left: 12px;
    background: rgba(20,20,35,0.94); backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
    padding: 16px; max-width: 300px; font-size: 13px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }
  #panel h2 { font-size: 15px; margin-bottom: 8px; color: #fff; }
  #panel .stat { display: flex; justify-content: space-between; padding: 3px 0; }
  #panel .stat span:last-child { color: #aaa; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 10px; }
  .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  #tooltip {
    position: absolute; pointer-events: none; opacity: 0;
    background: rgba(0,0,0,0.88); border: 1px solid rgba(255,255,255,0.2);
    border-radius: 6px; padding: 8px 12px; font-size: 12px; max-width: 380px;
    transition: opacity 0.15s; z-index: 100;
  }
  #filter {
    position: absolute; top: 12px; right: 12px;
    background: rgba(20,20,35,0.94); backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
    padding: 12px; font-size: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    z-index: 10;
  }
  #filter label { display: block; margin: 2px 0; cursor: pointer; color: #ccc; }
  #filter input { margin-right: 6px; accent-color: #6C5CE7; }
  #search {
    position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: rgba(20,20,35,0.94); backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2); border-radius: 20px;
    padding: 10px 20px; font-size: 14px; color: #e0e0e0;
    width: 340px; outline: none; z-index: 10;
  }
  #search::placeholder { color: #555; }
  #search:focus { border-color: #6C5CE7; }
</style>
</head>
<body>

<svg id="graph"></svg>

<div id="panel">
  <h2>📊 CodeGraph — live2d-mcp</h2>
  <div class="stat"><span>节点</span><span>${nodes.length}</span></div>
  <div class="stat"><span>边</span><span>${edges.length}</span></div>
  <div style="margin-top:8px;color:#777;font-size:11px;">🖱 滚轮缩放 | 拖拽平移<br>悬停查看详情 | 点击高亮关联<br>拖拽节点移动 | 搜索定位</div>
  <div class="legend" style="margin-top:12px;">
    ${Object.entries(colorMap).map(([k, c]) =>
      `<div class="legend-item"><span class="legend-dot" style="background:${c}"></span>${k}</div>`
    ).join('')}
  </div>
</div>

<div id="filter">
  <div style="color:#aaa;margin-bottom:6px;font-weight:600;">🔍 按类型过滤</div>
  ${[...new Set(nodes.map(n => n.kind))].sort().map(k =>
    `<label><input type="checkbox" class="kind-filter" data-kind="${k}" checked> <span class="legend-dot" style="background:${colorMap[k] || '#888'};display:inline-block;vertical-align:middle;margin-right:2px;"></span> ${k}</label>`
  ).join('')}
</div>

<div id="tooltip"></div>
<input id="search" type="text" placeholder="🔍 搜索符号、文件名...">

<script src="https://d3js.org/d3.v7.min.js"></script>
<script>
const raw = ${JSON.stringify({ nodes, edges })};
const colorMap = ${JSON.stringify(colorMap)};

// Build lookup
const nodeMap = new Map(raw.nodes.map(n => [n.id, n]));
raw.edges.forEach(e => { e.source = e.source; e.target = e.target; });

const width = window.innerWidth;
const height = window.innerHeight;

const svg = d3.select('#graph')
  .attr('width', width).attr('height', height);
const g = svg.append('g');

// Zoom behavior
svg.call(d3.zoom().scaleExtent([0.06, 10]).on('zoom', (e) => {
  g.attr('transform', e.transform);
}));

// Node radius by kind
function radius(kind) {
  const map = { file: 15, function: 8, interface: 8, type_alias: 7, constant: 6, variable: 6, import: 5, property: 6 };
  return map[kind] || 5;
}

// Simulation
const simulation = d3.forceSimulation(raw.nodes)
  .force('link', d3.forceLink(raw.edges).id(d => d.id).distance(d => {
    if (d.source.kind === 'file' && d.target.kind === 'file') return 350;
    if (d.kind === 'calls') return 100;
    if (d.kind === 'contains') return 50;
    return 80;
  }))
  .force('charge', d3.forceManyBody().strength(d => d.kind === 'file' ? -500 : -180))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collision', d3.forceCollide(d => radius(d.kind) + 4))
  .force('x', d3.forceX(width / 2).strength(0.01))
  .force('y', d3.forceY(height / 2).strength(0.01));

// Draw edges
const link = g.append('g').selectAll('line')
  .data(raw.edges)
  .join('line')
  .attr('stroke', d => {
    switch(d.kind) {
      case 'calls': return 'rgba(0,184,148,0.45)';
      case 'contains': return 'rgba(108,92,231,0.25)';
      case 'imports': return 'rgba(178,190,195,0.3)';
      case 'references': return 'rgba(9,132,227,0.3)';
      default: return 'rgba(255,255,255,0.12)';
    }
  })
  .attr('stroke-width', d => d.kind === 'calls' ? 1.6 : d.kind === 'contains' ? 0.6 : 0.8);

// Draw nodes
const node = g.append('g').selectAll('g')
  .data(raw.nodes)
  .join('g')
  .call(d3.drag()
    .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
    .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
    .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
  );

node.append('circle')
  .attr('r', d => radius(d.kind))
  .attr('fill', d => colorMap[d.kind] || '#888')
  .attr('stroke', '#1a1a2e')
  .attr('stroke-width', 1.5)
  .style('cursor', 'pointer')
  .style('transition', 'opacity 0.2s');

// Labels
node.append('text')
  .text(d => {
    const label = d.kind === 'file' ? d.file_path.replace(/.*[\\/]/, '') : d.name;
    return label.length > 30 ? label.slice(0, 28) + '…' : label;
  })
  .attr('x', d => radius(d.kind) + 4)
  .attr('y', 4)
  .attr('font-size', d => d.kind === 'file' ? 11 : 8.5)
  .attr('fill', d => d.kind === 'file' ? '#fff' : '#bbb')
  .attr('font-family', d => d.kind === 'file' ? 'system-ui, sans-serif' : "'Cascadia Code', 'Fira Code', monospace")
  .attr('font-weight', d => d.kind === 'file' ? 600 : 400)
  .style('pointer-events', 'none');

// Tooltip
const tooltip = d3.select('#tooltip');
node.on('mouseenter', (e, d) => {
  tooltip.style('opacity', 1)
    .html([
      '<div style="font-weight:600;color:#fff;margin-bottom:3px;font-size:13px;">' + d.name + '</div>',
      '<div style="color:#aaa;"><span style="background:' + (colorMap[d.kind]||'#888') + ';display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:5px;"></span>' + d.kind + '  ·  ' + d.language + '  ·  line ' + d.start_line + '</div>',
      '<div style="color:#6C5CE7;font-size:11px;margin-top:2px;word-break:break-all;">' + d.qualified_name + '</div>',
      '<div style="color:#666;font-size:10px;margin-top:3px;">📄 ' + d.file_path + '</div>',
    ].join(''));
}).on('mousemove', (e) => {
  let lx = e.pageX + 14, ly = e.pageY - 10;
  if (lx + 390 > width) lx = e.pageX - 400;
  if (ly + 100 > height) ly = e.pageY - 110;
  tooltip.style('left', lx + 'px').style('top', ly + 'px');
}).on('mouseleave', () => {
  tooltip.style('opacity', 0);
});

// Click to highlight connections (2s flash)
node.on('click', (e, d) => {
  const connIds = new Set();
  raw.edges.forEach(ed => {
    if (ed.source === d.id || ed.target === d.id) {
      connIds.add(ed.source); connIds.add(ed.target);
    }
  });
  connIds.add(d.id);
  node.select('circle').transition().duration(200).attr('opacity', n => connIds.has(n.id) ? 1 : 0.08);
  link.transition().duration(200).attr('opacity', l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.02);
  setTimeout(() => {
    node.select('circle').transition().duration(400).attr('opacity', 1);
    link.transition().duration(400).attr('opacity', 1);
  }, 2200);
});

// Tick
simulation.on('tick', () => {
  link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
  node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
});

// Kind filter
d3.selectAll('.kind-filter').on('change', function() {
  const kind = this.dataset.kind;
  const checked = this.checked;
  node.each(function(d) { if (d.kind === kind) d3.select(this).style('display', checked ? null : 'none'); });
  // Also hide edges where both endpoints are hidden
  link.each(function(l) {
    const s = nodeMap.get(l.source.id || l.source);
    const t = nodeMap.get(l.target.id || l.target);
    const sHidden = s && s.kind === kind && !checked;
    const tHidden = t && t.kind === kind && !checked;
    if (sHidden || tHidden) d3.select(this).style('display', 'none');
    else {
      // Check if either endpoint is hidden by any filter
      const anyHidden = [...d3.selectAll('.kind-filter')._groups[0]]
        .some(cb => {
          if (cb.checked) return false;
          const fk = cb.dataset.kind;
          return (s && s.kind === fk) || (t && t.kind === fk);
        });
      d3.select(this).style('display', anyHidden ? 'none' : null);
    }
  });
});

// Search
const searchInput = d3.select('#search');
let searchTimeout;
searchInput.on('input', function() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const q = this.value.toLowerCase().trim();
    if (!q) {
      node.style('opacity', 1);
      link.style('opacity', 1);
      return;
    }
    node.style('opacity', d => {
      const match = d.name.toLowerCase().includes(q) ||
        d.qualified_name.toLowerCase().includes(q) ||
        d.file_path.toLowerCase().includes(q);
      return match ? 1 : 0.06;
    });
    link.style('opacity', l => {
      const sid = l.source.id || l.source;
      const tid = l.target.id || l.target;
      const s = nodeMap.get(sid);
      const t = nodeMap.get(tid);
      const sm = s && (s.name.toLowerCase().includes(q) || s.qualified_name.toLowerCase().includes(q) || s.file_path.toLowerCase().includes(q));
      const tm = t && (t.name.toLowerCase().includes(q) || t.qualified_name.toLowerCase().includes(q) || t.file_path.toLowerCase().includes(q));
      return (sm || tm) ? 1 : 0.02;
    });
  }, 180);
});
</script>
</body>
</html>`;

fs.writeFileSync(outPath, html, 'utf-8');
console.log(`✅ Visualization written to: ${outPath}`);
console.log(`   Nodes: ${nodes.length} | Edges: ${edges.length}`);
console.log(`   Open: start scripts/codegraph-viz.html`);
