/**
 * IsoBuildings.js — isometric 3D buildings for every infrastructure component,
 * drawn as plain SVG (no images, no WebGL, no dependencies).
 *
 * Each building stands on a floating grass island. Level 1–4 changes the real
 * size of the island, footprint and height, so an upgrade looks bigger on the
 * map, not just a different color. isoBuild() returns the shapes; isoSVG()
 * returns ready-to-insert markup and caches it.
 */
function isoBuild(type, level, state, fit) {
  var C = 0.866, S = 0.5, K = 10;
  var L = Math.max(1, Math.min(4, level | 0 || 1));
  var st = state || 'idle';
  var out = [];
  var seq = 0;
  function r(v) { return Math.round(v * 10) / 10; }
  function P(x, y, z) { return [(x - y) * C * K, (x + y) * S * K - z * K]; }
  function hx(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function toHex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mix(a, b, t) { var A = hx(a), B = hx(b); return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); }
  function body(c) {
    if (st === 'failed') { var A = hx(c); var g = (A[0] + A[1] + A[2]) / 3; c = toHex([g * 0.8 + A[0] * 0.2, g * 0.8 + A[1] * 0.2, g * 0.8 + A[2] * 0.2]); c = mix(c, '#1a1d24', 0.35); }
    return c;
  }
  function shade(c) { c = body(c); return { t: mix(c, '#ffffff', 0.22), l: c, r: mix(c, '#05070c', 0.38) }; }
  function poly(p) { return 'M' + p.map(function (q) { return r(q[0]) + ' ' + r(q[1]); }).join('L') + 'Z'; }
  function add(d, f, o, extra) {
    var s = { d: d, f: f, o: o == null ? 1 : o, k: 'p' + (seq++) };
    if (extra) for (var e in extra) s[e] = extra[e];
    s.an = !!s.ov && !s.tv; s.mv = !!s.tv; s.st = !s.ov && !s.tv;
    if (!s.ov) s.ov = '1'; if (!s.du) s.du = '2s'; if (!s.b) s.b = '0s'; if (!s.tv) s.tv = '0 0';
    out.push(s); return s;
  }
  function quad(a, b, c, d2, f, o, ex) { add(poly([a, b, c, d2]), f, o, ex); }

  function box(x, y, z, w, d, h, col, tcol) {
    var s = typeof col === 'string' ? shade(col) : col;
    var x1 = x + w, y1 = y + d, z1 = z + h;
    quad(P(x, y1, z), P(x1, y1, z), P(x1, y1, z1), P(x, y1, z1), s.l);
    quad(P(x1, y, z), P(x1, y1, z), P(x1, y1, z1), P(x1, y, z1), s.r);
    quad(P(x, y, z1), P(x1, y, z1), P(x1, y1, z1), P(x, y1, z1), tcol ? body(tcol) : s.t);
  }
  // window grids on the two visible faces
  function glowCol() {
    return { idle: '#6cc4ef', processing: '#9be7ff', heavy: '#ff8a3d', scaling: '#9be7ff', failed: '#2a2f3a' }[st];
  }
  function winAnim(i) {
    if (st === 'processing') return { ov: '0.55;1;0.7;1;0.55', du: (1.6 + (i % 5) * 0.37).toFixed(2) + 's', b: ((i * 0.23) % 2).toFixed(2) + 's' };
    if (st === 'heavy') return { ov: '1;0.35;1;0.8;0.3;1', du: (0.5 + (i % 4) * 0.13).toFixed(2) + 's', b: ((i * 0.11) % 1).toFixed(2) + 's' };
    if (st === 'failed' && i % 7 === 3) return { ov: '0;0.9;0;0;0.7;0', du: '1.7s', b: ((i * 0.3) % 2).toFixed(2) + 's', fcol: '#ff3b3b' };
    return null;
  }
  var wi = 0;
  function windows(x, y, z, w, d, h, cols, rows, gc, opt) {
    opt = opt || {};
    var g = gc || glowCol();
    var idleOp = st === 'idle' ? 0.6 : 1;
    var x1 = x + w, y1 = y + d;
    var mz = h * 0.14, gapz = (h - mz * 2) / rows;
    function face(isLeft) {
      var len = isLeft ? w : d, n = isLeft ? cols : (opt.cols2 || cols);
      var m = len * 0.12, gap = (len - m * 2) / n;
      for (var i = 0; i < n; i++) for (var j = 0; j < rows; j++) {
        var a0 = m + i * gap + gap * 0.18, a1 = m + (i + 1) * gap - gap * 0.18;
        var z0 = z + mz + j * gapz + gapz * 0.2, z1 = z + mz + (j + 1) * gapz - gapz * 0.12;
        var pts = isLeft ? [P(x + a0, y1, z0), P(x + a1, y1, z0), P(x + a1, y1, z1), P(x + a0, y1, z1)]
                         : [P(x1, y + a0, z0), P(x1, y + a1, z0), P(x1, y + a1, z1), P(x1, y + a0, z1)];
        var an = winAnim(wi++);
        var col = an && an.fcol ? an.fcol : g;
        add(poly(pts), isLeft ? col : mix(col, '#0a1020', 0.25), an ? 1 : idleOp, an);
      }
    }
    if (opt.left !== false) face(true);
    if (opt.right !== false) face(false);
  }
  function ellipse(cx, cy, rx, ry) {
    return 'M' + r(cx - rx) + ' ' + r(cy) + 'A' + r(rx) + ' ' + r(ry) + ' 0 1 0 ' + r(cx + rx) + ' ' + r(cy) + 'A' + r(rx) + ' ' + r(ry) + ' 0 1 0 ' + r(cx - rx) + ' ' + r(cy) + 'Z';
  }
  function cyl(x, y, z, rad, h, col, tcol) {
    var s = typeof col === 'string' ? shade(col) : col;
    var b = P(x, y, z), t = P(x, y, z + h);
    var rx = rad * 1.2247 * K, ry = rad * 0.7071 * K;
    add('M' + r(b[0] - rx) + ' ' + r(t[1]) + 'L' + r(b[0] - rx) + ' ' + r(b[1]) + 'A' + r(rx) + ' ' + r(ry) + ' 0 0 0 ' + r(b[0]) + ' ' + r(b[1] + ry) + 'L' + r(b[0]) + ' ' + r(t[1]) + 'Z', s.l);
    add('M' + r(b[0]) + ' ' + r(t[1]) + 'L' + r(b[0]) + ' ' + r(b[1] + ry) + 'A' + r(rx) + ' ' + r(ry) + ' 0 0 0 ' + r(b[0] + rx) + ' ' + r(b[1]) + 'L' + r(b[0] + rx) + ' ' + r(t[1]) + 'Z', s.r);
    add(ellipse(t[0], t[1], rx, ry), tcol ? body(tcol) : s.t);
  }
  function ring(x, y, z, rad, th, col, o, ex) {
    var c = P(x, y, z), rx = rad * 1.2247 * K, ry = rad * 0.7071 * K, t = th * K;
    add('M' + r(c[0] - rx) + ' ' + r(c[1] - t) + 'A' + r(rx) + ' ' + r(ry) + ' 0 0 0 ' + r(c[0] + rx) + ' ' + r(c[1] - t) + 'L' + r(c[0] + rx) + ' ' + r(c[1]) + 'A' + r(rx) + ' ' + r(ry) + ' 0 0 1 ' + r(c[0] - rx) + ' ' + r(c[1]) + 'Z', col, o, ex);
  }
  function disc(x, y, z, rad, col, o, ex) {
    var c = P(x, y, z); add(ellipse(c[0], c[1], rad * 1.2247 * K, rad * 0.7071 * K), col, o, ex);
  }
  function prism(cx, cy, z, rad, h, n, col, rot, tcol) {
    var s = typeof col === 'string' ? shade(col) : col;
    var v = [];
    for (var i = 0; i < n; i++) { var a = (rot || 0) + i * Math.PI * 2 / n; v.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
    var faces = [];
    for (var i2 = 0; i2 < n; i2++) {
      var A = v[i2], B = v[(i2 + 1) % n];
      var nx = (A[1] + B[1]) / 2 - cy, ny = (A[0] + B[0]) / 2 - cx; // unused orientation fix below
      var mx = (A[0] + B[0]) / 2 - cx, my = (A[1] + B[1]) / 2 - cy;
      if (mx + my > 0.001) faces.push({ A: A, B: B, mx: mx, my: my, depth: mx + my });
    }
    faces.sort(function (p, q) { return p.depth - q.depth; });
    faces.forEach(function (f) {
      var t = (f.mx - f.my) / (Math.abs(f.mx) + Math.abs(f.my)); // -1 = left face, +1 = right face
      var c = mix(s.l, s.r, (t + 1) / 2);
      quad(P(f.A[0], f.A[1], z), P(f.B[0], f.B[1], z), P(f.B[0], f.B[1], z + h), P(f.A[0], f.A[1], z + h), c);
    });
    add(poly(v.map(function (q) { return P(q[0], q[1], z + h); })), tcol ? body(tcol) : s.t);
    return v;
  }
  function pyramid(x, y, z, w, d, h, col) {
    var s = typeof col === 'string' ? shade(col) : col;
    var ap = P(x + w / 2, y + d / 2, z + h);
    add(poly([P(x, y + d, z), P(x + w, y + d, z), ap]), s.l);
    add(poly([P(x + w, y, z), P(x + w, y + d, z), ap]), s.r);
  }
  function pole(x, y, z, h, th, col) { box(x - th / 2, y - th / 2, z, th, th, h, col); }
  function glowOrb(x, y, z, rad, col, anim) {
    var c = P(x, y, z);
    var ex = anim ? { ov: '0.25;0.6;0.25', du: '2.4s' } : null;
    add(ellipse(c[0], c[1], rad * 2.4 * K, rad * 2.4 * K), col, 0.12, ex);
    add(ellipse(c[0], c[1], rad * 1.5 * K, rad * 1.5 * K), col, 0.25, ex);
    add(ellipse(c[0], c[1], rad * K, rad * K), mix(col, '#ffffff', 0.5));
    add(ellipse(c[0] - rad * 0.3 * K, c[1] - rad * 0.3 * K, rad * 0.4 * K, rad * 0.4 * K), '#ffffff', 0.85);
  }
  function tree(x, y, s2) {
    var b = P(x, y, 0);
    box(x - 0.08 * s2, y - 0.08 * s2, 0, 0.16 * s2, 0.16 * s2, 0.4 * s2, '#6b4429');
    var t = P(x, y, 1.9 * s2), m = P(x, y, 0.35 * s2);
    var w = 0.62 * s2 * K;
    add(poly([[m[0] - w, m[1]], [m[0], m[1] + w * 0.35], t]), body('#3f9a3a'));
    add(poly([[m[0], m[1] + w * 0.35], [m[0] + w, m[1]], t]), body('#2a6b2b'));
    var m2 = P(x, y, 0.95 * s2), w2 = w * 0.75;
    add(poly([[m2[0] - w2, m2[1]], [m2[0], m2[1] + w2 * 0.35], t]), body('#4caf45'));
    add(poly([[m2[0], m2[1] + w2 * 0.35], [m2[0] + w2, m2[1]], t]), body('#2f7a30'));
  }
  function rock(x, y, s2) { box(x, y, 0, 0.35 * s2, 0.3 * s2, 0.22 * s2, '#7d8594'); }
  function lamp(x, y) { pole(x, y, 0, 1.0, 0.07, '#4b5568'); glowOrb(x, y, 1.05, 0.09, '#ffd27a'); }

  // ---------- island ----------
  var N = [4.4, 5.4, 6.4, 7.4][L - 1];
  var h0 = -N / 2;
  function island() {
    var g0 = P(h0, h0 + N, -0.7), g1 = P(h0 + N, h0 + N, -0.7), g2 = P(h0 + N, h0, -0.7);
    var depth = N * K * 0.45;
    var tip = [g1[0] + N * 0.4, g1[1] + depth];
    add(poly([g0, [g0[0] + N * K * 0.25, g0[1] + depth * 0.45], [g1[0] - N * K * 0.2, g1[1] + depth * 0.7], tip, g1]), body('#5a4334'));
    add(poly([g1, tip, [g2[0] - N * K * 0.22, g2[1] + depth * 0.5], g2]), body('#3b2c23'));
    add(poly([[g1[0] - N * K * 0.42, g1[1] + depth * 0.3], [g1[0] - N * K * 0.12, g1[1] + depth * 0.95], [g1[0] - N * K * 0.02, g1[1] + depth * 0.4]]), body('#47362b'));
    box(h0, h0, -0.7, N, N, 0.42, { t: '#000', l: body('#7a5233'), r: body('#593b25') });
    box(h0, h0, -0.28, N, N, 0.28, { t: body('#62b545'), l: body('#4e9a37'), r: body('#3b7a2a') });
    // paved pad
    var pad = N * 0.78;
    add(poly([P(-pad / 2, -pad / 2, 0), P(pad / 2, -pad / 2, 0), P(pad / 2, pad / 2, 0), P(-pad / 2, pad / 2, 0)]), body('#3a4252'));
    var p2 = pad - 0.25;
    add(poly([P(-p2 / 2, -p2 / 2, 0), P(p2 / 2, -p2 / 2, 0), P(p2 / 2, p2 / 2, 0), P(-p2 / 2, p2 / 2, 0)]), body('#454f62'));
  }
  function decor(front) {
    var e = N / 2 - 0.45;
    var spots = [[-e, -e + 0.3, 't'], [e - 0.1, -e, 't'], [-e, e - 0.4, 'r'], [-e + 0.2, 0.2, 't'], [0.4, -e, 'r'], [e, e, 't'], [-e, e, 't'], [e, 0.6, 'l'], [-0.8, e, 'l']];
    var n = [3, 5, 7, 9][L - 1];
    spots.slice(0, n).forEach(function (s) {
      var isFront = s[0] + s[1] > 0;
      if (isFront !== !!front) return;
      if (s[2] === 't') tree(s[0], s[1], 0.75 + L * 0.05);
      else if (s[2] === 'r') rock(s[0] - 0.15, s[1] - 0.15, 1);
      else lamp(s[0], s[1]);
    });
  }

  // ---------- state overlays ----------
  function topFx(x, y, z, accent) {
    if (st === 'processing') {
      for (var i = 0; i < 5; i++) {
        var c = P(x + (i % 3 - 1) * 0.6, y + ((i * 2) % 3 - 1) * 0.6, z + 0.3);
        var sz = 2.6;
        add(poly([[c[0], c[1] - sz], [c[0] + sz, c[1]], [c[0], c[1] + sz], [c[0] - sz, c[1]]]), '#b6f3ff', 1,
          { ov: '0;1;1;0', tv: '0 0;0 -' + (22 + i * 3), du: (1.8 + i * 0.25).toFixed(2) + 's', b: (i * 0.4).toFixed(1) + 's' });
      }
    }
    if (st === 'heavy') {
      for (var j = 0; j < 6; j++) {
        var c2 = P(x + (j % 3 - 1) * 0.8, y + ((j * 2) % 3 - 1) * 0.7, z + 0.2);
        add(ellipse(c2[0], c2[1], 1.6, 1.6), j % 2 ? '#ffb347' : '#ff5a2e', 1,
          { ov: '0;1;0', tv: '0 0;' + ((j % 2 ? 4 : -4)) + ' -' + (18 + j * 4), du: (1.1 + j * 0.2).toFixed(2) + 's', b: (j * 0.25).toFixed(2) + 's' });
      }
    }
    if (st === 'failed') {
      for (var k = 0; k < 5; k++) {
        var c3 = P(x + 0.3, y - 0.2, z + 0.2);
        add(ellipse(c3[0], c3[1], 4 + k, 4 + k), k % 2 ? '#5b6170' : '#3d424d', 1,
          { ov: '0;0.85;0', tv: '0 0;' + (8 + k * 2) + ' -' + (34 + k * 6), du: (3 + k * 0.4).toFixed(1) + 's', b: (k * 0.7).toFixed(1) + 's' });
      }
      var w = P(x, y, z + 3.2);
      add(poly([[w[0], w[1] - 9], [w[0] + 9, w[1] + 7], [w[0] - 9, w[1] + 7]]), '#ff3b3b', 1, { ov: '1;0.35;1', du: '1.2s' });
      add(poly([[w[0] - 1, w[1] - 3], [w[0] + 1, w[1] - 3], [w[0] + 0.8, w[1] + 2.5], [w[0] - 0.8, w[1] + 2.5]]), '#1a0606');
      add(ellipse(w[0], w[1] + 4.6, 1.1, 1.1), '#1a0606');
    }
  }
  function baseFx(fw) {
    if (st === 'heavy') {
      disc(0, 0, 0.02, fw * 0.75, '#ff4d2e', 0.18, { ov: '0.1;0.32;0.1', du: '0.9s' });
      disc(0, 0, 0.02, fw * 0.55, '#ff8a3d', 0.22, { ov: '0.15;0.4;0.15', du: '0.9s', b: '0.3s' });
    }
    if (st === 'processing') {
      ring(0, 0, 0.03, fw * 0.72, 0.06, '#6fe3ff', 0.7, { ov: '0.2;0.8;0.2', du: '2s' });
    }
  }
  function scaffold(x, y, z, w, d, h, ghost) {
    if (st !== 'scaling') return;
    var Y = '#f5b70a';
    // back-left scaffolding poles + planks on front faces
    var cols = Math.max(2, Math.round(w / 0.9));
    for (var i = 0; i <= cols; i++) pole(x + i * w / cols, y + d + 0.25, z, h + 0.4, 0.06, Y);
    for (var j = 1; j <= Math.max(2, Math.round(h / 1.2)); j++) box(x - 0.05, y + d + 0.15, z + j * h / Math.max(2, Math.round(h / 1.2)), w + 0.1, 0.22, 0.07, '#c98a06');
    // ghost of the next module
    if (ghost) {
      var gz = z + h;
      var gs = { t: '#8fe9ff', l: '#5cc7ff', r: '#2f8fd6' };
      var x1 = x + w * 0.1, y1 = y + d * 0.1, w1 = w * 0.8, d1 = d * 0.8, h1 = h * 0.45;
      var ex = { ov: '0.18;0.45;0.18', du: '2.2s' };
      quad(P(x1, y1 + d1, gz), P(x1 + w1, y1 + d1, gz), P(x1 + w1, y1 + d1, gz + h1), P(x1, y1 + d1, gz + h1), gs.l, 0.3, ex);
      quad(P(x1 + w1, y1, gz), P(x1 + w1, y1 + d1, gz), P(x1 + w1, y1 + d1, gz + h1), P(x1 + w1, y1, gz + h1), gs.r, 0.3, ex);
      quad(P(x1, y1, gz + h1), P(x1 + w1, y1, gz + h1), P(x1 + w1, y1 + d1, gz + h1), P(x1, y1 + d1, gz + h1), gs.t, 0.3, ex);
    }
    // crane
    var cx = x - 0.6, cy = y + 0.2, ch = h + 2.6;
    pole(cx, cy, 0, ch, 0.16, Y);
    for (var k = 1; k < ch / 0.6; k++) box(cx - 0.12, cy - 0.12, k * 0.6, 0.24, 0.24, 0.05, '#b37a05');
    box(cx - 0.3, cy - 0.1, ch, 0.15 + w + 1.2, 0.2, 0.18, Y);
    box(cx - 1.1, cy - 0.15, ch - 0.2, 0.6, 0.3, 0.35, '#5b6475');
    var hk = cx + w * 0.7 + 0.6;
    pole(hk, cy, ch - 1.6, 1.6, 0.03, '#2b2f38');
    box(hk - 0.18, cy - 0.18, ch - 1.95, 0.36, 0.36, 0.35, '#ff8c1a');
  }

  // ---------- buildings ----------
  var T = {};
  T.server = function () {
    var f = [2.2, 2.7, 3.2, 3.6][L - 1], H = [2.6, 3.9, 5.4, 7.2][L - 1];
    var x = -f / 2, y = -f / 2;
    baseFx(f);
    box(x - 0.3, y - 0.3, 0, f + 0.6, f + 0.6, 0.35, '#4a5468');
    if (L >= 2) { // rear annex
      var aw = [0, 1.4, 1.7, 2.0][L - 1];
      box(x - aw + 0.2, y - 0.1, 0.35, aw, f * 0.75, H * 0.45, '#2d55b8');
      windows(x - aw + 0.2, y - 0.1, 0.35, aw, f * 0.75, H * 0.45, 2, L >= 3 ? 2 : 1, null, { right: false });
    }
    if (L >= 3) { // right wing
      box(x + 0.2, y - 1.6, 0.35, f * 0.7, 1.4, H * 0.55, '#2d55b8');
      windows(x + 0.2, y - 1.6, 0.35, f * 0.7, 1.4, H * 0.55, 2, 2, null, { left: false, cols2: 2 });
    }
    var tierH = L === 4 ? [H * 0.55, H * 0.3, H * 0.15] : L === 3 ? [H * 0.65, H * 0.35] : [H];
    var z = 0.35, ix = x, iy = y, iw = f;
    tierH.forEach(function (th, i) {
      box(ix, iy, z, iw, iw, th, '#3567d6');
      // floor bands
      box(ix - 0.06, iy - 0.06, z + th - 0.16, iw + 0.12, iw + 0.12, 0.16, '#5b6b88');
      var rows = Math.max(1, Math.round(th / 0.85));
      windows(ix, iy, z, iw, iw, th - 0.16, Math.max(2, Math.round(iw / 0.75)), rows);
      z += th; ix += 0.35; iy += 0.35; iw -= 0.7;
    });
    var top = z, cx = ix + iw / 2, cy = iy + iw / 2;
    // rooftop gear
    box(cx - 0.55, cy - 0.7, top, 0.6, 0.5, 0.35, '#8892a6');
    if (L >= 2) { box(cx + 0.1, cy - 0.15, top, 0.5, 0.5, 0.3, '#8892a6'); disc(cx + 0.35, cy + 0.1, top + 0.31, 0.18, '#2b2f3a'); }
    pole(cx - 0.5 + iw * 0.3, cy + 0.4, top, [1.2, 1.5, 1.8, 1.4][L - 1], 0.06, '#9aa4b8');
    glowOrb(cx - 0.5 + iw * 0.3, cy + 0.4, top + [1.25, 1.55, 1.85, 1.45][L - 1], 0.1, st === 'failed' ? '#ff3b3b' : '#ff4d6d', st !== 'failed');
    if (L >= 3) { // dish
      pole(cx - 0.2, cy + 0.15, top, 0.5, 0.08, '#9aa4b8');
      var dc = P(cx - 0.2, cy + 0.15, top + 0.7);
      add(ellipse(dc[0], dc[1], 6, 4), body('#dfe6f2')); add(ellipse(dc[0] + 0.8, dc[1] + 0.4, 4, 2.6), body('#9fb0c8'));
    }
    if (L === 4) { // glowing core crystal
      var cc = P(cx, cy, top + 0.1), ct = P(cx, cy, top + 2.2), cm = P(cx, cy, top + 1.0);
      add(poly([cc, [cm[0] - 6, cm[1]], ct]), st === 'failed' ? '#3a3f4b' : '#67e8f9', 1, st === 'failed' ? null : { ov: '0.7;1;0.7', du: '2.6s' });
      add(poly([cc, [cm[0] + 6, cm[1]], ct]), st === 'failed' ? '#2a2e38' : '#22b8d6', 1);
      if (st !== 'failed') glowOrb(cx, cy, top + 1.1, 0.25, '#67e8f9', true);
    }
    // side server racks
    if (L >= 2) { box(x + f + 0.45, y + f * 0.15, 0, 0.5, 0.8, 0.9, '#3a4356'); windows(x + f + 0.45, y + f * 0.15, 0, 0.5, 0.8, 0.9, 1, 3, null, { left: false, cols2: 2 }); }
    if (L >= 3) { box(x + 0.1, y + f + 0.5, 0, 0.9, 0.5, 1.1, '#3a4356'); windows(x + 0.1, y + f + 0.5, 0, 0.9, 0.5, 1.1, 2, 3, null, { right: false }); }
    if (L === 4) { box(x + f * 0.55, y + f + 0.5, 0, 0.9, 0.5, 1.1, '#3a4356'); windows(x + f * 0.55, y + f + 0.5, 0, 0.9, 0.5, 1.1, 2, 3, null, { right: false }); }
    scaffold(x, y, 0.35, f, f, H, true);
    topFx(cx, cy, top, '#9be7ff');
  };
  T.lb = function () {
    var R = [1.4, 1.75, 2.05, 2.35][L - 1], H = [1.2, 1.6, 2.0, 2.4][L - 1];
    baseFx(R * 1.4);
    prism(0, 0, 0, R + 0.35, 0.35, 8, '#4a5468', Math.PI / 8);
    // arms (data ports) — back ones first
    var arms = [[-1, 0], [0, -1], [1, 0], [0, 1]].slice(0, [2, 3, 4, 4][L - 1]);
    var armL = [1.0, 1.2, 1.4, 1.5][L - 1];
    arms.filter(function (a) { return a[0] + a[1] < 0; }).forEach(arm);
    prism(0, 0, 0.35, R, H, 8, '#e08a12', Math.PI / 8);
    // window band
    var gc = glowCol();
    ring(0, 0, 0.35 + H * 0.55, R * 1.01, H * 0.22, gc, st === 'idle' ? 0.6 : 1, winAnim(1));
    if (L >= 2) ring(0, 0, 0.35 + H * 0.9, R * 1.01, 0.12, '#ffcc66', 0.9);
    // roof
    prism(0, 0, 0.35 + H, R * 0.86, 0.25, 8, '#5b6478', Math.PI / 8);
    var rz = 0.6 + H;
    var pr = R * 0.72;
    pyramid(-pr * 0.72, -pr * 0.72, rz, pr * 1.44, pr * 1.44, [1.0, 1.3, 1.6, 2.0][L - 1], '#f5a524');
    var bz = rz + [1.0, 1.3, 1.6, 2.0][L - 1];
    pole(0, 0, bz - 0.1, 0.5, 0.07, '#9aa4b8');
    glowOrb(0, 0, bz + 0.5, [0.16, 0.2, 0.24, 0.28][L - 1], st === 'failed' ? '#ff3b3b' : '#ffd166', st !== 'failed');
    if (L >= 3) { pole(R * 0.55, -R * 0.4, rz, 0.9, 0.05, '#9aa4b8'); glowOrb(R * 0.55, -R * 0.4, rz + 0.95, 0.09, '#7cf3c9'); }
    arms.filter(function (a) { return a[0] + a[1] > 0; }).forEach(arm);
    function arm(a) {
      var w = 0.7;
      var x0 = a[0] === 0 ? -w / 2 : (a[0] > 0 ? R * 0.7 : -R * 0.7 - armL);
      var y0 = a[1] === 0 ? -w / 2 : (a[1] > 0 ? R * 0.7 : -R * 0.7 - armL);
      var ww = a[0] === 0 ? w : armL, dd = a[1] === 0 ? w : armL;
      box(x0, y0, 0.35, ww, dd, 0.5, '#c9741a');
      box(x0 + 0.08, y0 + 0.08, 0.85, ww - 0.16, dd - 0.16, 0.08, '#5b6478');
      var ex = a[0] > 0 ? x0 + ww : a[0] < 0 ? x0 : 0, ey = a[1] > 0 ? y0 + dd : a[1] < 0 ? y0 : 0;
      box(ex - 0.35, ey - 0.35, 0.35, 0.7, 0.7, 0.85, '#7a5a3a');
      glowOrb(ex, ey, 1.5, 0.13, st === 'failed' ? '#3a3f4b' : '#7cf3c9', st === 'processing');
    }
    scaffold(-R, -R, 0.35, R * 2, R * 2, H, false);
    topFx(0, 0, bz + 0.6);
  };
  T.db = function () {
    var R = [1.0, 1.25, 1.5, 1.8][L - 1], n = [2, 3, 4, 5][L - 1], dh = [0.8, 0.85, 0.95, 1.0][L - 1];
    baseFx(R * 1.6);
    prism(0, 0, 0, R + 0.6, 0.35, 6, '#4a5468', 0);
    if (L >= 2) { cyl(-R - 0.9, -0.6, 0.35, 0.5, 1.4 + L * 0.3, '#5b3fb3'); ring(-R - 0.9, -0.6, 1.2, 0.5, 0.1, glowCol(), 0.9); }
    if (L >= 3) { cyl(0.3, -R - 1.0, 0.35, 0.55, 1.6 + L * 0.3, '#5b3fb3'); ring(0.3, -R - 1.0, 1.4, 0.55, 0.1, glowCol(), 0.9); box(-R - 0.6, -0.75, 1.0, 0.8, 0.25, 0.2, '#8892a6'); }
    var z = 0.35;
    for (var i = 0; i < n; i++) {
      cyl(0, 0, z, R, dh, '#7c4dff', i === n - 1 ? '#b39dff' : null);
      ring(0, 0, z + 0.06, R * 1.005, 0.14, glowCol(), st === 'idle' ? 0.6 : 1, winAnim(i * 3));
      // little drive-light dots
      for (var k = 0; k < 3; k++) {
        var a = Math.PI * (0.15 + k * 0.28);
        var p = P(Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98, z + dh * 0.55);
        add(ellipse(p[0], p[1], 1.2, 1.2), '#e3d9ff', 0.9, st === 'processing' ? { ov: '0.2;1;0.2', du: (0.8 + k * 0.3) + 's', b: (i * 0.2) + 's' } : null);
      }
      z += dh;
    }
    if (L >= 4) { cyl(1.0, R + 1.0, 0.35, 0.6, 2.4, '#5b3fb3'); ring(1.0, R + 1.0, 1.6, 0.6, 0.12, glowCol(), 0.9); }
    if (L >= 3) { // crown
      cyl(0, 0, z, R * 0.55, 0.35, '#5b6478');
      glowOrb(0, 0, z + 0.75, 0.22 + L * 0.03, st === 'failed' ? '#ff3b3b' : '#c4b5fd', st !== 'failed');
    }
    if (L >= 2) { cyl(R + 0.7, 0.4, 0, 0.35, 0.8, '#3a4356'); }
    scaffold(-R, -R, 0.35, R * 2, R * 2, z - 0.35, false);
    topFx(0, 0, z + 0.4);
  };
  T.cache = function () {
    var w = [2.4, 2.9, 3.4, 3.9][L - 1], n = [2, 3, 4, 5][L - 1];
    baseFx(w);
    box(-w / 2 - 0.3, -w / 2 - 0.3, 0, w + 0.6, w + 0.6, 0.35, '#4a5468');
    if (L >= 2) { // RAM sticks behind
      for (var s = 0; s < L; s++) box(-w / 2 - 0.1 + s * 0.45, -w / 2 - 0.9, 0.35, 0.25, 0.6, 1.4 + L * 0.2, '#0f8f66'), windows(-w / 2 - 0.1 + s * 0.45, -w / 2 - 0.9, 0.35, 0.25, 0.6, 1.4 + L * 0.2, 1, 3, '#7dffcf', { left: false, cols2: 1 });
    }
    var z = 0.35, sw = w, th = 0.55;
    for (var i = 0; i < n; i++) {
      box(-sw / 2, -sw / 2, z, sw, sw, th, '#12b981', i === n - 1 ? '#6ff2c2' : null);
      // glowing seam
      var gc = st === 'failed' ? '#2a2f3a' : st === 'heavy' ? '#ff8a3d' : '#b7ffe4';
      var an = winAnim(i * 2 + 1);
      quad(P(-sw / 2, sw / 2, z + th * 0.42), P(sw / 2, sw / 2, z + th * 0.42), P(sw / 2, sw / 2, z + th * 0.58), P(-sw / 2, sw / 2, z + th * 0.58), gc, st === 'idle' ? 0.55 : 1, an);
      quad(P(sw / 2, -sw / 2, z + th * 0.42), P(sw / 2, sw / 2, z + th * 0.42), P(sw / 2, sw / 2, z + th * 0.58), P(sw / 2, -sw / 2, z + th * 0.58), mix(gc, '#0a1020', 0.25), st === 'idle' ? 0.55 : 1, an);
      z += th; sw *= 0.78;
    }
    // floating crystal
    var cz = z + 0.45 + L * 0.1, cs = 0.5 + L * 0.12;
    var c0 = P(0, 0, cz), c1 = P(0, 0, cz + cs * 2.2), cm = P(0, 0, cz + cs * 1.1);
    var ok = st !== 'failed';
    var fl = ok ? { tv: '0 0;0 -3;0 0', ov: '1', du: '3s' } : null;
    add(poly([c1, [cm[0] - cs * 8, cm[1]], c0]), ok ? '#a7ffe0' : '#3a3f4b', 1, fl);
    add(poly([c1, [cm[0] + cs * 8, cm[1]], c0]), ok ? '#2ee6a6' : '#2a2e38', 1, fl);
    add(poly([[cm[0] - cs * 8, cm[1]], [cm[0], cm[1] + cs * 2], c0]), ok ? '#5cf5c0' : '#30343e', 0.9, fl);
    if (ok) glowOrb(0, 0, cz + cs * 1.1, cs * 0.6, '#5cf5c0', true);
    if (L >= 3) { box(w / 2 + 0.4, -0.5, 0, 0.6, 1.0, 0.7, '#3a4356'); lampG(w / 2 + 0.7, 0, 0.7); }
    if (L >= 4) { box(-0.6, w / 2 + 0.45, 0, 1.2, 0.5, 0.6, '#3a4356'); lampG(0, w / 2 + 0.7, 0.6); }
    function lampG(x, y, z2) { glowOrb(x, y, z2 + 0.2, 0.1, '#7dffcf'); }
    scaffold(-w / 2, -w / 2, 0.35, w, w, z - 0.35, false);
    topFx(0, 0, cz + cs);
  };
  T.queue = function () {
    var len = [3.0, 3.8, 4.6, 5.4][L - 1], dp = [1.7, 2.0, 2.3, 2.6][L - 1], H = [1.3, 1.6, 2.0, 2.4][L - 1];
    var x = -len / 2, y = -dp / 2 - 0.4;
    baseFx(len * 0.7);
    box(x - 0.3, y - 0.3, 0, len + 0.6, dp + 1.6, 0.35, '#4a5468');
    // chimney(s) behind
    var ch = [1, 1, 2, 2][L - 1];
    for (var c = 0; c < ch; c++) { cyl(x + 0.6 + c * 1.2, y + 0.4, 0.35, 0.28, H + 1.4 + L * 0.2, '#7a3b2a'); ring(x + 0.6 + c * 1.2, y + 0.4, H + 1.5 + L * 0.2, 0.28, 0.12, '#ff9b42', 1, st === 'processing' || st === 'heavy' ? { ov: '0.5;1;0.5', du: '1s' } : null); }
    box(x, y, 0.35, len, dp, H, '#d4562a');
    // sawtooth roof
    var teeth = [2, 3, 4, 5][L - 1], tw = len / teeth;
    for (var t = 0; t < teeth; t++) {
      var tx = x + t * tw, tz = 0.35 + H;
      var s2 = shade('#9a3d22');
      quad(P(tx, y + dp, tz), P(tx + tw, y + dp, tz), P(tx + tw, y + dp, tz + 0.7), P(tx + tw, y + dp, tz + 0.7), s2.l);
      quad(P(tx, y, tz), P(tx + tw, y, tz + 0.7), P(tx + tw, y + dp, tz + 0.7), P(tx, y + dp, tz), s2.t);
      quad(P(tx + tw, y, tz), P(tx + tw, y + dp, tz), P(tx + tw, y + dp, tz + 0.7), P(tx + tw, y, tz + 0.7), st === 'failed' ? '#2a2f3a' : '#ffb15c', st === 'idle' ? 0.7 : 1, winAnim(t + 2));
    }
    windows(x, y, 0.35, len, dp, H, teeth * 2, 1, st === 'idle' || st === 'scaling' ? '#ffb86b' : null, {});
    // loading door
    quad(P(x + len, y + dp * 0.3, 0.35), P(x + len, y + dp * 0.75, 0.35), P(x + len, y + dp * 0.75, 0.35 + H * 0.7), P(x + len, y + dp * 0.3, 0.35 + H * 0.7), body('#2b1a14'));
    // conveyor in front, packets queued
    var by = y + dp + 0.35;
    box(x - 0.2, by, 0.35, len + 1.2, 0.6, 0.2, '#30343e');
    box(x - 0.2, by + 0.05, 0.55, len + 1.2, 0.5, 0.04, '#1c1f26');
    var np = [3, 4, 6, 8][L - 1];
    for (var p = 0; p < np; p++) {
      var px = x + 0.1 + p * (len + 0.6) / np;
      var mv = st === 'processing' || st === 'heavy';
      var shp = out.length;
      box(px, by + 0.12, 0.59, 0.34, 0.34, 0.3, st === 'heavy' && p % 2 ? '#ff5a2e' : '#ffb347');
      if (mv) for (var q = shp; q < out.length; q++) { var o = out[q]; o.tv = '0 0;' + r((len + 0.6) / np * C * K) + ' ' + r((len + 0.6) / np * S * K); o.ov = '1'; o.du = st === 'heavy' ? '0.7s' : '1.4s'; o.mv = true; o.st = false; }
    }
    scaffold(x, y, 0.35, len, dp, H, false);
    topFx(x + 0.6, y + 0.4, H + 1.8);
  };
  T.cdn = function () {
    var D = [1.3, 1.7, 2.1, 2.5][L - 1], tower = [1.0, 1.5, 2.0, 2.6][L - 1];
    baseFx(2);
    prism(0, 0, 0, 1.7 + L * 0.2, 0.35, 6, '#4a5468', Math.PI / 6);
    if (L >= 2) { box(-2.0, -1.2, 0.35, 1.2, 1.1, 1.0, '#2a4f9e'); windows(-2.0, -1.2, 0.35, 1.2, 1.1, 1.0, 2, 1); }
    if (L >= 3) { box(0.6, -2.2, 0.35, 1.0, 1.0, 1.2, '#2a4f9e'); windows(0.6, -2.2, 0.35, 1.0, 1.0, 1.2, 2, 1); smallDish(1.1, -1.7, 1.55, 0.5); }
    if (L >= 4) { smallDish(-1.4, -0.65, 1.35, 0.55); }
    cyl(0, 0, 0.35, 0.9 + L * 0.1, 0.6, '#3a4356');
    cyl(0, 0, 0.95, 0.35, tower, '#8892a6');
    var hz = 0.95 + tower;
    box(-0.3, -0.3, hz, 0.6, 0.6, 0.4, '#5b6478');
    // dish: tilted ellipse facing up-left
    var c = P(0, 0, hz + 0.5 + D * 0.55);
    var rx = D * K * 1.25, ry = D * K * 0.95;
    var rot = 'rotate(-28 ' + r(c[0]) + ' ' + r(c[1]) + ')';
    add(ellipse(c[0] + 2, c[1] + 3, rx, ry), body('#7f8ba3'), 1, { tf: rot });
    add(ellipse(c[0], c[1], rx, ry), body('#e7edf7'), 1, { tf: rot });
    add(ellipse(c[0] - 1.5, c[1] - 1.5, rx * 0.8, ry * 0.78), body('#c3cee0'), 1, { tf: rot });
    add(ellipse(c[0] - 3, c[1] - 3, rx * 0.5, ry * 0.48), body('#aab8cf'), 1, { tf: rot });
    // feed arm
    var f0 = [c[0] - 2, c[1] - 2], f1 = [c[0] - rx * 0.55, c[1] - ry * 0.95];
    add(poly([[f0[0] - 1, f0[1]], [f0[0] + 1, f0[1]], [f1[0] + 1, f1[1]], [f1[0] - 1, f1[1]]]), body('#5b6478'));
    var ok = st !== 'failed';
    var fc = ok ? (st === 'heavy' ? '#ff8a3d' : '#67e8f9') : '#3a3f4b';
    add(ellipse(f1[0], f1[1], 9, 9), fc, ok ? 0.15 : 0, ok ? { ov: '0.1;0.35;0.1', du: '1.8s' } : null);
    add(ellipse(f1[0], f1[1], 3.2, 3.2), fc);
    // signal waves
    if (ok && st !== 'idle') for (var w = 0; w < 3; w++) {
      add('M' + r(f1[0] - 6 - w * 5) + ' ' + r(f1[1] - 4 - w * 4) + 'A' + (8 + w * 6) + ' ' + (8 + w * 6) + ' 0 0 1 ' + r(f1[0] + 4 + w * 5) + ' ' + r(f1[1] - 8 - w * 5) + 'L' + r(f1[0] + 4 + w * 5) + ' ' + r(f1[1] - 6.5 - w * 5) + 'A' + (6.5 + w * 6) + ' ' + (6.5 + w * 6) + ' 0 0 0 ' + r(f1[0] - 5 - w * 5) + ' ' + r(f1[1] - 2.8 - w * 4) + 'Z', fc, 1, { ov: '0;1;0', du: st === 'heavy' ? '0.8s' : '1.6s', b: (w * 0.3) + 's' });
    }
    if (L >= 2) { // globe hologram ring
      ring(0, 0, 0.8, 1.6 + L * 0.25, 0.05, ok ? '#67e8f9' : '#3a3f4b', 0.8, ok ? { ov: '0.3;0.9;0.3', du: '3s' } : null);
    }
    function smallDish(x, y, z, s) {
      pole(x, y, z - 0.4, 0.4, 0.06, '#8892a6');
      var c2 = P(x, y, z + 0.25);
      add(ellipse(c2[0], c2[1], s * 11, s * 8), body('#dfe6f2'), 1, { tf: 'rotate(-28 ' + r(c2[0]) + ' ' + r(c2[1]) + ')' });
      add(ellipse(c2[0] - 1, c2[1] - 1, s * 7, s * 5), body('#aab8cf'), 1, { tf: 'rotate(-28 ' + r(c2[0]) + ' ' + r(c2[1]) + ')' });
    }
    scaffold(-0.9, -0.9, 0.35, 1.8, 1.8, tower + 0.6, false);
    topFx(0, 0, hz + D + 0.6);
  };
  T.firewall = function () {
    var R = [1.9, 2.4, 2.9, 3.4][L - 1], wh = [0.8, 1.0, 1.2, 1.4][L - 1], kh = [1.8, 2.4, 3.0, 3.8][L - 1], kw = [1.3, 1.6, 1.9, 2.2][L - 1];
    var wall = '#626b80', th = 0.45;
    baseFx(R * 1.2);
    box(-R - 0.2, -R - 0.2, 0, R * 2 + 0.4, R * 2 + 0.4, 0.3, '#4a5468');
    function crenel(x, y, w, d, z, alongX) {
      var n = Math.max(2, Math.round((alongX ? w : d) / 0.42));
      for (var i = 0; i < n; i += 2) {
        var o = i * (alongX ? w : d) / n, s = (alongX ? w : d) / n;
        box(alongX ? x + o : x, alongX ? y : y + o, z, alongX ? s : w, alongX ? d : s, 0.22, wall);
      }
    }
    // back walls
    box(-R, -R, 0.3, R * 2, th, wh, wall); crenel(-R, -R, R * 2, th, 0.3 + wh, true);
    box(-R, -R, 0.3, th, R * 2, wh, wall); crenel(-R, -R, th, R * 2, 0.3 + wh, false);
    tower(-R, -R);
    if (L >= 3) { tower(R - 0.75, -R); tower(-R, R - 0.75); }
    // keep
    var kx = -kw / 2, ky = -kw / 2;
    box(kx, ky, 0.3, kw, kw, kh, '#9b3a33');
    windows(kx, ky, 0.3, kw, kw, kh * 0.55, 2, L >= 3 ? 2 : 1, st === 'idle' || st === 'scaling' ? '#ff9e7a' : null);
    crenel(kx, ky, kw, kw, 0.3 + kh, true);
    box(kx - 0.08, ky - 0.08, 0.3 + kh - 0.12, kw + 0.16, kw + 0.16, 0.12, '#6b2a25');
    // shield emblem on left face
    var sc = P(kx + kw / 2, ky + kw + 0.02, 0.3 + kh * 0.72), ss = 5 + L * 1.6;
    var ok = st !== 'failed', shc = ok ? (st === 'heavy' ? '#ffb020' : '#ff3d4f') : '#4a2a2a';
    add(ellipse(sc[0], sc[1], ss * 1.9, ss * 1.9), shc, ok ? 0.18 : 0, ok ? { ov: '0.1;0.35;0.1', du: st === 'heavy' ? '0.6s' : '2s' } : null);
    add('M' + r(sc[0] - ss) + ' ' + r(sc[1] - ss) + 'L' + r(sc[0] + ss) + ' ' + r(sc[1] - ss * 0.5) + 'L' + r(sc[0] + ss) + ' ' + r(sc[1] + ss * 0.3) + 'Q' + r(sc[0] + ss * 0.6) + ' ' + r(sc[1] + ss * 1.3) + ' ' + r(sc[0]) + ' ' + r(sc[1] + ss * 1.5) + 'Q' + r(sc[0] - ss * 0.8) + ' ' + r(sc[1] + ss * 0.9) + ' ' + r(sc[0] - ss) + ' ' + r(sc[1] + ss * 0.1) + 'Z', shc);
    add('M' + r(sc[0] - ss * 0.15) + ' ' + r(sc[1] - ss * 0.4) + 'L' + r(sc[0] + ss * 0.25) + ' ' + r(sc[1] - ss * 0.2) + 'L' + r(sc[0] + ss * 0.25) + ' ' + r(sc[1] + ss * 0.7) + 'L' + r(sc[0] - ss * 0.15) + ' ' + r(sc[1] + ss * 0.5) + 'Z', ok ? '#ffe0e4' : '#3a2a2a', 0.9);
    // front walls with gate
    box(R - th, -R, 0.3, th, R * 2, wh, wall); crenel(R - th, -R, th, R * 2, 0.3 + wh, false);
    box(-R, R - th, 0.3, R * 0.75, th, wh, wall); box(R * 0.25, R - th, 0.3, R * 0.75, th, wh, wall);
    box(-R * 0.25, R - th, 0.3 + wh * 0.65, R * 0.5, th, wh * 0.35, wall);
    crenel(-R, R - th, R * 2, th, 0.3 + wh, true);
    quad(P(-R * 0.25, R, 0.3), P(R * 0.25, R, 0.3), P(R * 0.25, R, 0.3 + wh * 0.65), P(-R * 0.25, R, 0.3 + wh * 0.65), ok ? (st === 'heavy' ? '#ff8a3d' : '#ff5c6c') : '#1a1d24', ok ? 0.85 : 1, ok ? { ov: '0.5;0.95;0.5', du: '1.6s' } : null);
    tower(R - 0.75, R - 0.75);
    if (L >= 2) tower(R - 0.75, -R), tower(-R, R - 0.75);
    function tower(x, y) {
      box(x - 0.05, y - 0.05, 0.3, 0.85, 0.85, wh + 0.7, '#565e72');
      box(x - 0.12, y - 0.12, 0.3 + wh + 0.7, 0.99, 0.99, 0.18, '#9b3a33');
      glowOrb(x + 0.4, y + 0.4, 0.3 + wh + 1.15, 0.09, ok ? '#ff6b6b' : '#3a3f4b', ok && st !== 'idle');
    }
    scaffold(kx, ky, 0.3, kw, kw, kh, false);
    topFx(0, 0, 0.6 + kh);
  };
  T.broker = function () {
    var R = [1.2, 1.5, 1.8, 2.1][L - 1], H = [1.4, 1.8, 2.3, 2.8][L - 1], pyl = [3, 4, 6, 6][L - 1], pr = R + [0.9, 1.0, 1.1, 1.2][L - 1];
    baseFx(pr);
    prism(0, 0, 0, pr + 0.45, 0.35, 6, '#3a4152', 0);
    var ok = st !== 'failed';
    var gold = ok ? (st === 'heavy' ? '#ff8a3d' : '#ffc53d') : '#3a3f4b';
    var pylons = [];
    for (var i = 0; i < pyl; i++) { var a = Math.PI * 2 * i / pyl + Math.PI / 4; pylons.push([Math.cos(a) * pr, Math.sin(a) * pr]); }
    pylons.sort(function (p, q) { return (p[0] + p[1]) - (q[0] + q[1]); });
    var back = pylons.filter(function (p) { return p[0] + p[1] <= 0; }), front = pylons.filter(function (p) { return p[0] + p[1] > 0; });
    back.forEach(pylon);
    prism(0, 0, 0.35, R, H, 6, '#2a2f3d', 0);
    for (var b = 0; b < [1, 2, 2, 3][L - 1]; b++) ring(0, 0, 0.35 + H * (0.35 + b * 0.25), R * 0.99, 0.1, gold, 1, winAnim(b * 4));
    prism(0, 0, 0.35 + H, R * 0.8, 0.3, 6, '#b8860b', 0);
    var oz = 0.35 + H + 0.9 + L * 0.1;
    if (ok) {
      ring(0, 0, oz - 0.2, 0.75 + L * 0.08, 0.06, gold, 0.9, { ov: '0.4;1;0.4', du: '2s' });
      glowOrb(0, 0, oz, 0.3 + L * 0.04, gold, true);
    } else glowOrb(0, 0, oz, 0.3, '#3a3f4b', false);
    front.forEach(pylon);
    // beams from pylons to orb (topics)
    if (ok && st !== 'idle') pylons.forEach(function (p, i) {
      var a = P(p[0], p[1], 1.6 + L * 0.2), c = P(0, 0, oz);
      add(poly([[a[0], a[1] - 0.6], [c[0], c[1] - 0.6], [c[0], c[1] + 0.6], [a[0], a[1] + 0.6]]), gold, 0.6, { ov: '0;0.8;0', du: st === 'heavy' ? '0.6s' : '1.6s', b: (i * 0.25) + 's' });
    });
    function pylon(p) {
      var ph = 1.4 + L * 0.2;
      box(p[0] - 0.22, p[1] - 0.22, 0.35, 0.44, 0.44, ph, '#454c5e');
      box(p[0] - 0.28, p[1] - 0.28, 0.35 + ph, 0.56, 0.56, 0.12, '#b8860b');
      glowOrb(p[0], p[1], 0.35 + ph + 0.3, 0.12, gold, ok && st !== 'idle');
    }
    scaffold(-R, -R, 0.35, R * 2, R * 2, H, false);
    topFx(0, 0, oz + 0.4);
  };

  // ---------- AI agent buildings ----------
  // AI model: a domed data hall with a glowing "brain" core and GPU racks
  T.brain = function () {
    var R = [1.2, 1.5, 1.8, 2.1][L - 1], H = [1.2, 1.5, 1.8, 2.1][L - 1];
    var ok = st !== 'failed';
    var core = ok ? (st === 'heavy' ? '#ff8a3d' : '#c084fc') : '#3a3f4b';
    baseFx(R * 1.5);
    prism(0, 0, 0, R + 0.6, 0.35, 8, '#4a5468', Math.PI / 8);
    // GPU racks behind (one more per level)
    for (var g = 0; g < L; g++) {
      var gx = -R - 1.0, gy = -R + g * 0.75;
      box(gx, gy, 0.35, 0.6, 0.55, 1.1 + L * 0.15, '#2b2f45');
      windows(gx, gy, 0.35, 0.6, 0.55, 1.1 + L * 0.15, 1, 3, ok ? '#a78bfa' : null, { left: false, cols2: 1 });
    }
    cyl(0, 0, 0.35, R, H, '#4c1d95');
    ring(0, 0, 0.35 + H * 0.45, R * 1.01, H * 0.25, glowCol(), st === 'idle' ? 0.6 : 1, winAnim(2));
    cyl(0, 0, 0.35 + H, R * 0.85, 0.25, '#6d28d9');
    // glass dome: layered discs, the brain glows inside
    var dz = 0.6 + H;
    for (var d = 0; d < 4; d++) disc(0, 0, dz + d * R * 0.22, R * 0.82 * Math.cos(d * 0.38), mix('#c4b5fd', '#ffffff', d * 0.15), 0.35);
    glowOrb(0, 0, dz + R * 0.45, 0.35 + L * 0.06, core, ok);
    if (ok) {
      ring(0, 0, dz + R * 0.45, R * 0.95, 0.05, core, 0.85, { ov: '0.3;1;0.3', du: st === 'heavy' ? '0.8s' : '2.2s' });
      if (L >= 3) ring(0, 0, dz + R * 0.75, R * 0.7, 0.04, '#f0abfc', 0.8, { ov: '1;0.3;1', du: '2.6s' });
    }
    // cooling unit in front
    if (L >= 2) { box(R * 0.4, R + 0.3, 0, 1.0, 0.6, 0.6, '#3a4356'); disc(R * 0.9, R + 0.6, 0.62, 0.22, '#1c1f26'); }
    scaffold(-R, -R, 0.35, R * 2, R * 2, H, false);
    topFx(0, 0, dz + R);
  };
  // Knowledge base: a library with a columned front and a tall shelf tower
  T.library = function () {
    var w = [2.4, 2.9, 3.4, 3.9][L - 1], d = [1.8, 2.1, 2.4, 2.7][L - 1], H = [1.2, 1.5, 1.8, 2.1][L - 1];
    var x = -w / 2, y = -d / 2;
    var books = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899'];
    baseFx(w * 0.8);
    box(x - 0.3, y - 0.3, 0, w + 0.6, d + 0.8, 0.35, '#4a5468');
    // shelf tower at the back: stacked "books"
    var tz = 0.35, bh = 0.42, bx = x + w - 1.1, by = y - 0.25;
    for (var b = 0; b < 4 + L; b++) { box(bx, by, tz, 0.9, 0.9, bh, books[b % books.length]); tz += bh; }
    box(bx - 0.1, by - 0.1, tz, 1.1, 1.1, 0.12, '#e5e7eb');
    box(x, y, 0.35, w, d, H, '#d6cfc2');
    windows(x, y, 0.35, w, d, H, Math.max(2, Math.round(w / 0.8)), 1, st === 'idle' || st === 'scaling' ? '#fde68a' : null);
    // pediment roof
    var s2 = shade('#b45309');
    var rz = 0.35 + H, ph = 0.6 + L * 0.1;
    add(poly([P(x, y + d, rz), P(x + w, y + d, rz), P(x + w / 2, y + d, rz + ph)]), mix('#e7dfd1', '#ffffff', 0.1));
    quad(P(x + w / 2, y, rz + ph), P(x + w / 2, y + d, rz + ph), P(x + w, y + d, rz), P(x + w, y, rz), s2.r);
    quad(P(x, y, rz), P(x + w / 2, y, rz + ph), P(x + w / 2, y + d, rz + ph), P(x, y + d, rz), s2.t);
    // columns in front
    var cols = [3, 4, 5, 6][L - 1];
    for (var c = 0; c < cols; c++) cyl(x + 0.25 + c * (w - 0.5) / (cols - 1), y + d + 0.35, 0.35, 0.12, H, '#f5f5f4');
    box(x - 0.1, y + d + 0.1, 0.35 + H, w + 0.2, 0.5, 0.12, '#e7e5e4');
    // a glowing "search" lens over the roof
    var ok = st !== 'failed';
    glowOrb(x + w / 2, y + d / 2, rz + ph + 0.7, 0.18 + L * 0.03, ok ? '#fde68a' : '#3a3f4b', ok && st !== 'idle');
    scaffold(x, y, 0.35, w, d, H, false);
    topFx(x + w / 2, y + d / 2, rz + ph);
  };
  // Tool server: a workshop with a big gear on the roof and a robot arm
  T.workshop = function () {
    var w = [2.2, 2.7, 3.2, 3.7][L - 1], H = [1.3, 1.6, 1.9, 2.2][L - 1];
    var x = -w / 2, y = -w / 2;
    var ok = st !== 'failed';
    baseFx(w * 0.8);
    box(x - 0.3, y - 0.3, 0, w + 0.6, w + 0.6, 0.35, '#4a5468');
    box(x, y, 0.35, w, w, H, '#0e7490');
    windows(x, y, 0.35, w, w, H, Math.max(2, Math.round(w / 0.8)), Math.max(1, L - 1), st === 'idle' ? '#a5f3fc' : null);
    // roller door
    quad(P(x + w * 0.3, y + w, 0.35), P(x + w * 0.7, y + w, 0.35), P(x + w * 0.7, y + w, 0.35 + H * 0.6), P(x + w * 0.3, y + w, 0.35 + H * 0.6), body('#164e63'));
    // gear: a thin 16-sided disc with teeth
    var gz = 0.35 + H, gr = w * 0.32;
    var spin = ok && st !== 'idle';
    for (var t = 0; t < 8; t++) {
      var a = t * Math.PI / 4, tx = Math.cos(a) * gr, ty = Math.sin(a) * gr;
      box(tx - 0.16, ty - 0.16, gz, 0.32, 0.32, 0.25, '#94a3b8');
    }
    prism(0, 0, gz, gr * 0.95, 0.25, 16, '#cbd5e1');
    cyl(0, 0, gz + 0.25, gr * 0.35, 0.12, '#475569');
    if (spin) ring(0, 0, gz + 0.3, gr * 1.1, 0.04, '#67e8f9', 0.8, { ov: '0.2;1;0.2', du: st === 'heavy' ? '0.5s' : '1.2s' });
    // robot arm beside the building (longer with each level)
    var ax = x + w + 0.5, ay = y + 0.4, ah = 0.8 + L * 0.35;
    box(ax - 0.25, ay - 0.25, 0, 0.5, 0.5, 0.3, '#f59e0b');
    pole(ax, ay, 0.3, ah, 0.14, '#f59e0b');
    box(ax - 0.1, ay - 0.9, 0.3 + ah, 0.2, 1.0, 0.16, '#f59e0b');
    glowOrb(ax, ay - 0.9, 0.3 + ah - 0.1, 0.09, ok ? '#67e8f9' : '#3a3f4b', spin);
    scaffold(x, y, 0.35, w, w, H, false);
    topFx(0, 0, gz + 0.4);
  };
  // Guardrail: a checkpoint gate, two pylons with a scanning energy wall
  T.shield = function () {
    var span = [2.6, 3.2, 3.8, 4.4][L - 1], ph = [2.0, 2.5, 3.0, 3.6][L - 1];
    var ok = st !== 'failed';
    var beam = ok ? (st === 'heavy' ? '#ff8a3d' : '#34d399') : '#3a3f4b';
    baseFx(span * 0.6);
    box(-span / 2 - 0.6, -0.9, 0, span + 1.2, 1.8, 0.35, '#4a5468');
    // control booth at the back
    box(-0.7, -1.8, 0.35, 1.4, 0.9, 1.0 + L * 0.15, '#1f2937');
    windows(-0.7, -1.8, 0.35, 1.4, 0.9, 1.0 + L * 0.15, 2, 1, ok ? '#6ee7b7' : null);
    function pylon(px) {
      box(px - 0.3, -0.3, 0.35, 0.6, 0.6, ph, '#065f46');
      box(px - 0.38, -0.38, 0.35 + ph, 0.76, 0.76, 0.15, '#10b981');
      glowOrb(px, 0, 0.35 + ph + 0.35, 0.12, beam, ok && st !== 'idle');
    }
    pylon(-span / 2);
    // the energy wall between the pylons
    quad(P(-span / 2 + 0.3, 0, 0.45), P(span / 2 - 0.3, 0, 0.45), P(span / 2 - 0.3, 0, 0.35 + ph - 0.1), P(-span / 2 + 0.3, 0, 0.35 + ph - 0.1), beam, ok ? 0.25 : 0.6, ok ? { ov: '0.15;0.4;0.15', du: st === 'heavy' ? '0.6s' : '1.8s' } : null);
    // scan lines moving down the wall
    if (ok) for (var i = 0; i < 2 + L; i++) {
      var z0 = 0.35 + ph * (0.2 + i * 0.7 / (2 + L));
      quad(P(-span / 2 + 0.3, 0, z0), P(span / 2 - 0.3, 0, z0), P(span / 2 - 0.3, 0, z0 + 0.06), P(-span / 2 + 0.3, 0, z0 + 0.06), mix(beam, '#ffffff', 0.4), 0.9, { ov: '0;1;0', du: '1.4s', b: (i * 0.3).toFixed(1) + 's' });
    }
    pylon(span / 2);
    // shield emblem on top of the booth
    var sc = P(0, -1.35, 1.6 + L * 0.15), ss = 4 + L;
    add('M' + r(sc[0] - ss) + ' ' + r(sc[1] - ss) + 'L' + r(sc[0] + ss) + ' ' + r(sc[1] - ss) + 'L' + r(sc[0] + ss) + ' ' + r(sc[1] + ss * 0.2) + 'Q' + r(sc[0]) + ' ' + r(sc[1] + ss * 1.6) + ' ' + r(sc[0] - ss) + ' ' + r(sc[1] + ss * 0.2) + 'Z', beam);
    scaffold(-span / 2, -0.3, 0.35, span, 0.6, ph, false);
    topFx(0, 0, ph + 0.6);
  };
  // Orchestrator: a control tower with helper drones circling it
  T.tower = function () {
    var R = [0.7, 0.85, 1.0, 1.15][L - 1], H = [2.4, 3.0, 3.6, 4.2][L - 1];
    var ok = st !== 'failed';
    var lit = ok ? (st === 'heavy' ? '#ff8a3d' : '#fbbf24') : '#3a3f4b';
    baseFx(2.2);
    prism(0, 0, 0, 1.9 + L * 0.2, 0.35, 6, '#4a5468', Math.PI / 6);
    box(-1.6, -1.6, 0.35, 1.3, 1.3, 0.8, '#334155');
    windows(-1.6, -1.6, 0.35, 1.3, 1.3, 0.8, 2, 1, ok ? '#fde68a' : null);
    cyl(0, 0, 0.35, R, H, '#475569');
    ring(0, 0, 0.35 + H * 0.3, R * 1.01, 0.12, lit, 0.8);
    ring(0, 0, 0.35 + H * 0.6, R * 1.01, 0.12, lit, 0.8);
    // cabin
    var cz = 0.35 + H;
    prism(0, 0, cz, R * 1.7, 0.7, 8, '#1e293b', Math.PI / 8);
    ring(0, 0, cz + 0.15, R * 1.7, 0.45, ok ? '#fde68a' : '#2a2f3a', st === 'idle' ? 0.6 : 1, winAnim(3));
    prism(0, 0, cz + 0.7, R * 1.85, 0.15, 8, '#f59e0b', Math.PI / 8);
    pole(0, 0, cz + 0.85, 0.8, 0.06, '#9aa4b8');
    glowOrb(0, 0, cz + 1.7, 0.14, lit, ok);
    // helper agents: small drones around the tower, one beam each to the cabin
    var n = L + 2;
    for (var h = 0; h < n; h++) {
      var a = Math.PI * 2 * h / n + 0.4, dr = R * 1.7 + 1.3;
      var hx2 = Math.cos(a) * dr, hy = Math.sin(a) * dr, hz = cz - 0.6 + (h % 2) * 0.5;
      if (ok && st !== 'idle') {
        var p0 = P(hx2, hy, hz), p1 = P(0, 0, cz + 0.35);
        add(poly([[p0[0], p0[1] - 0.5], [p1[0], p1[1] - 0.5], [p1[0], p1[1] + 0.5], [p0[0], p0[1] + 0.5]]), lit, 0.5, { ov: '0;0.8;0', du: st === 'heavy' ? '0.7s' : '1.6s', b: (h * 0.25).toFixed(2) + 's' });
      }
      glowOrb(hx2, hy, hz, 0.14, ok ? '#93c5fd' : '#3a3f4b', ok && st !== 'idle');
    }
    scaffold(-R, -R, 0.35, R * 2, R * 2, H, false);
    topFx(0, 0, cz + 1.2);
  };

  island();
  decor(false);
  (T[type] || T.server)();
  decor(true);

  // viewBox: fixed frame (same scale for every level) or fitted to content
  var vb = fit ? null : '-96 -150 192 240';
  if (fit) {
    var mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    out.forEach(function (s) {
      if (s.tv !== '0 0' || s.tf) return;
      var cmds = s.d.match(/[A-Z][^A-Z]*/g) || [];
      cmds.forEach(function (c) {
        var n = c.slice(1).trim().split(/[\s,]+/).map(Number);
        if (n.length < 2) return;
        var X = n[n.length - 2], Yv = n[n.length - 1];
        if (c[0] === 'A') { var rx = n[0], ry = n[1]; if (X - rx < mnx) mnx = X - rx * 2; if (Yv - ry < mny) mny = Yv - ry; if (Yv + ry > mxy) mxy = Yv + ry; }
        if (X < mnx) mnx = X; if (X > mxx) mxx = X; if (Yv < mny) mny = Yv; if (Yv > mxy) mxy = Yv;
      });
    });
    var pad = 10;
    vb = r(mnx - pad) + ' ' + r(mny - pad - 14) + ' ' + r(mxx - mnx + pad * 2) + ' ' + r(mxy - mny + pad * 2 + 14);
  }
  out.forEach(function (s) { if (!s.tf) s.tf = ''; });
  return { shapes: out, vb: vb };
}

// Same type + level + state always draws the same building, so each SVG is built once
const svgCache = new Map();

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * SVG markup for one building.
 *   type  server | lb | db | cache | queue | cdn | firewall | broker | brain | library | workshop | shield | tower
 *   level 1–4 (bigger level = physically bigger building, same scale for every level)
 *   state idle | processing | heavy | scaling | failed
 *   opts.fit   crop to the building instead of the shared Lv 1–4 frame
 *   opts.label accessible name
 */
export function isoSVG(type, level = 1, state = 'idle', opts = {}) {
  const still = reducedMotion();
  const key = `${type}|${level}|${state}|${opts.fit ? 1 : 0}|${still ? 1 : 0}`;
  let body = svgCache.get(key);
  if (!body) {
    const g = isoBuild(type, level, state, opts.fit);
    const paths = g.shapes.map(s => {
      const anim = (s.an || s.mv) && !still;
      const tf = s.tf ? ` transform="${s.tf}"` : '';
      if (!anim) {
        // Moving bits (packets, smoke) sit at their start, where they're hidden; skip them when still
        if (s.mv) return '';
        return `<path d="${s.d}" fill="${s.f}" opacity="${s.o}"${tf}/>`;
      }
      const fade = `<animate attributeName="opacity" values="${s.ov}" dur="${s.du}" begin="${s.b}" repeatCount="indefinite"/>`;
      const move = s.mv ? `<animateTransform attributeName="transform" type="translate" values="${s.tv}" dur="${s.du}" begin="${s.b}" repeatCount="indefinite"/>` : '';
      return `<path d="${s.d}" fill="${s.f}" opacity="${s.o}">${fade}${move}</path>`;
    }).join('');
    body = { vb: g.vb, paths };
    svgCache.set(key, body);
  }
  const label = opts.label ? ` role="img" aria-label="${opts.label}"` : ' aria-hidden="true"';
  const cls = opts.className ? ` class="${opts.className}"` : '';
  return `<svg viewBox="${body.vb}" xmlns="http://www.w3.org/2000/svg"${cls}${label} focusable="false">${body.paths}</svg>`;
}

export { isoBuild };
