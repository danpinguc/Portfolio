// ─────────────────────────────────────────
// Collage Layout — Bin-packed mosaic
// Center-outward placement, adjacency-aware,
// no mask. Fills rectangular container with
// varied-size images. Reflows on resize.
// ─────────────────────────────────────────

(function () {
  'use strict';

  var GAP = 28;
  var TARGET_CELL = 45; // finer grid = more flexibility for placement
  var TIER_PX = { L: 280, M: 190, S: 160 };

  // Seeded random for deterministic layout
  var seed = 1;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  // ── Grid helpers ──
  function makeGrid(rows, cols) {
    var g = [];
    for (var r = 0; r < rows; r++) { g[r] = []; for (var c = 0; c < cols; c++) g[r][c] = false; }
    return g;
  }

  function canPlace(grid, col, row, cw, ch, cols, rows) {
    if (col < 0 || row < 0 || col + cw > cols || row + ch > rows) return false;
    for (var r = row; r < row + ch; r++)
      for (var c = col; c < col + cw; c++)
        if (grid[r][c]) return false;
    return true;
  }

  function markGrid(grid, col, row, cw, ch) {
    for (var r = row; r < row + ch; r++)
      for (var c = col; c < col + cw; c++)
        grid[r][c] = true;
  }

  function distCenter(col, row, cw, ch, cols, rows) {
    var dx = (col + cw / 2) - cols / 2;
    var dy = (row + ch / 2) - rows / 2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Count filled neighbors for adjacency-aware packing
  function adjacency(grid, col, row, cw, ch, cols, rows) {
    var n = 0;
    for (var dc = 0; dc < cw; dc++) {
      if (row > 0 && grid[row - 1][col + dc]) n++;
      if (row + ch < rows && grid[row + ch][col + dc]) n++;
    }
    for (var dr = 0; dr < ch; dr++) {
      if (col > 0 && grid[row + dr][col - 1]) n++;
      if (col + cw < cols && grid[row + dr][col + cw]) n++;
    }
    return n;
  }

  // ── Cell dims with slight variation ──
  function getCellDims(ratio, tier, cellW, cellH, scale, cols, rows) {
    var targetW = (TIER_PX[tier] || TIER_PX.M) * scale;
    var cw = Math.max(1, Math.round(targetW / (cellW + GAP)));
    var ch = Math.max(1, Math.round(cw * cellW / (ratio * cellH)));

    // ±1 cell random variation
    if (cw >= 3 && rand() > 0.55) cw += (rand() > 0.5 ? 1 : -1);
    if (ch >= 3 && rand() > 0.55) ch += (rand() > 0.5 ? 1 : -1);

    var minCell = tier === 'S' ? 1 : 2; // small images can be 1-cell to fit gaps
    cw = Math.min(cw, Math.max(2, Math.round(cols * 0.30)));
    ch = Math.min(ch, Math.max(2, Math.round(rows * 0.40)));
    return { c: Math.max(minCell, cw), r: Math.max(minCell, ch) };
  }

  // ── Find best placement ──
  // gapFill mode: heavily prefer spots with many neighbors (filling holes)
  function findBest(grid, cw, ch, cols, rows, hasNeighbors, gapFill) {
    var candidates = [];
    for (var r = 0; r <= rows - ch; r++) {
      for (var c = 0; c <= cols - cw; c++) {
        if (canPlace(grid, c, r, cw, ch, cols, rows)) {
          var d = distCenter(c, r, cw, ch, cols, rows);
          var adj = hasNeighbors ? adjacency(grid, c, r, cw, ch, cols, rows) : 0;
          var score = gapFill ? (d - adj * 4) : (d - adj * 1.5);
          candidates.push({ col: c, row: r, score: score });
        }
      }
    }
    if (!candidates.length) return null;

    candidates.sort(function (a, b) { return a.score - b.score; });
    var pick = Math.min(candidates.length, 3);
    return candidates[Math.floor(rand() * pick)];
  }

  // ── Place all images ──
  function placeAll(pieces, grid, cols, rows) {
    var placements = [];

    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      var placed = false;
      var hasN = placements.length > 0;
      var isSmall = p.tier === 'S';

      // Small images use gap-fill mode (heavily prefer spots next to existing images)
      var pos = findBest(grid, p.cw, p.cr, cols, rows, hasN, isSmall && hasN);
      if (pos) {
        markGrid(grid, pos.col, pos.row, p.cw, p.cr);
        placements.push({ el: p.el, col: pos.col, row: pos.row, cw: p.cw, ch: p.cr });
        placed = true;
      }

      if (!placed) {
        // Shrink fallback — small images can go down to 1×1
        var minC = isSmall ? 1 : 2;
        var minR = isSmall ? 1 : 2;
        var tries = [
          { c: Math.max(minC, p.cw - 1), r: p.cr },
          { c: p.cw, r: Math.max(minR, p.cr - 1) },
          { c: Math.max(minC, p.cw - 1), r: Math.max(minR, p.cr - 1) },
          { c: 2, r: 2 }, { c: 2, r: 1 }, { c: 1, r: 2 }, { c: 1, r: 1 }
        ];
        for (var t = 0; t < tries.length && !placed; t++) {
          var s = tries[t];
          pos = findBest(grid, s.c, s.r, cols, rows, true, true);
          if (pos) {
            markGrid(grid, pos.col, pos.row, s.c, s.r);
            placements.push({ el: p.el, col: pos.col, row: pos.row, cw: s.c, ch: s.r });
            placed = true;
          }
        }
      }

      if (!placed) p.el.style.display = 'none';
    }
    return placements;
  }

  // ── Apply positions ──
  function applyPositions(placements, cellW, cellH, W, H) {
    for (var k = 0; k < placements.length; k++) {
      var pm = placements[k];
      pm.el.style.position = 'absolute';
      pm.el.style.display = '';
      pm.el.style.left   = ((GAP + pm.col * (cellW + GAP)) / W * 100).toFixed(2) + '%';
      pm.el.style.top    = ((GAP + pm.row * (cellH + GAP)) / H * 100).toFixed(2) + '%';
      pm.el.style.width  = ((pm.cw * cellW + (pm.cw - 1) * GAP) / W * 100).toFixed(2) + '%';
      pm.el.style.height = ((pm.ch * cellH + (pm.ch - 1) * GAP) / H * 100).toFixed(2) + '%';
    }
  }

  // ── Main ──
  function layout() {
    var container = document.querySelector('.collage-grid');
    if (!container) return;

    var items = [].slice.call(container.querySelectorAll('.collage-img'));
    if (!items.length) return;

    var W = container.clientWidth;
    var H = container.clientHeight;
    if (!W || !H) return;

    seed = 42;

    var isMobile = W < 600;
    var cols = Math.max(6, Math.round(W / TARGET_CELL));
    var rows = Math.max(4, Math.round(H / TARGET_CELL));
    var cellW = (W - GAP * (cols + 1)) / cols;
    var cellH = (H - GAP * (rows + 1)) / rows;

    var scale = isMobile ? 0.65 : W < 800 ? 0.7 : W < 1000 ? 0.8 : 1;

    var pieces = items.map(function (el) {
      var ratio = parseFloat(el.getAttribute('data-ratio')) || 1;
      var tier = el.getAttribute('data-tier') || 'M';
      var dims = getCellDims(ratio, tier, cellW, cellH, scale, cols, rows);
      return { el: el, ratio: ratio, tier: tier, cw: dims.c, cr: dims.r, area: dims.c * dims.r };
    });

    // Sort large first, shuffle similar sizes
    pieces.sort(function (a, b) {
      var diff = b.area - a.area;
      if (Math.abs(diff) <= 2) return rand() > 0.5 ? 1 : -1;
      return diff;
    });

    var grid = makeGrid(rows, cols);
    var placements = placeAll(pieces, grid, cols, rows);
    applyPositions(placements, cellW, cellH, W, H);
  }

  var timer;
  function onResize() { clearTimeout(timer); timer = setTimeout(layout, 60); }
  function init() { layout(); window.addEventListener('resize', onResize); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
