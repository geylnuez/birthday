(function () {
  var cv = document.getElementById('c');
  var ctx = cv.getContext('2d');
  var zone = document.getElementById('zone');
  var plug = document.getElementById('plug');
  var plane = document.getElementById('plane');
  var pcap = document.getElementById('pcap');
  var note = document.getElementById('note');
  var dim = document.getElementById('dim');
  var closeBtn = document.getElementById('close');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The song. It starts when the plug is clicked. To use a different song, replace
  // song.mp3 with your own file (keep the name), or change the name below.
  var SONG_FILE = 'song.mp3';
  var SONG_VOLUME = 0.55;
  // Where the song begins, in seconds (37 = 0:37). It also restarts here when it loops.
  // Set this to 0 to play song.mp3 from the very start.
  var SONG_START = 37;
  var song = new Audio(SONG_FILE);
  song.preload = 'auto';
  song.addEventListener('ended', function () {
    song.currentTime = SONG_START;
    var again = song.play();
    if (again && again.catch) again.catch(function () {});
  });
  function playSong() {
    song.volume = 0;
    if (song.readyState >= 1) {
      song.currentTime = SONG_START;
    } else {
      song.addEventListener('loadedmetadata', function () { song.currentTime = SONG_START; }, { once: true });
    }
    var p = song.play();
    if (p && p.catch) p.catch(function () {});
    var started = performance.now();
    (function fade() {
      var k = Math.min(1, (performance.now() - started) / 3500);
      song.volume = SONG_VOLUME * k;
      if (k < 1) requestAnimationFrame(fade);
    })();
  }

  // Each letter is 4 units wide and 6 tall, drawn as strokes along which the bulbs sit.
  var GLYPH = {
    H: [[[0,0],[0,6]], [[4,0],[4,6]], [[0,3],[4,3]]],
    A: [[[0,6],[0,1],[1,0],[3,0],[4,1],[4,6]], [[0,3.5],[4,3.5]]],
    P: [[[0,6],[0,0],[3,0],[4,1],[4,2.5],[3,3.5],[0,3.5]]],
    Y: [[[0,0],[2,3],[4,0]], [[2,3],[2,6]]],
    B: [[[0,0],[0,6]], [[0,0],[3,0],[4,1],[4,2],[3,3],[0,3]], [[3,3],[4,4],[4,5],[3,6],[0,6]]],
    I: [[[0,0],[4,0]], [[2,0],[2,6]], [[0,6],[4,6]]],
    R: [[[0,6],[0,0],[3,0],[4,1],[4,2],[3,3],[0,3]], [[2,3],[4,6]]],
    T: [[[0,0],[4,0]], [[2,0],[2,6]]],
    D: [[[0,0],[0,6]], [[0,0],[2.5,0],[4,1.2],[4,4.8],[2.5,6],[0,6]]]
  };

  // A warm, happy string: amber, coral, rose, honey and cream, repeating along the wire.
  var PAL = [
    { glow: '#ffa63d', core: '#ffe2b0' },
    { glow: '#ff6f61', core: '#ffd0c8' },
    { glow: '#ff8fab', core: '#ffdbe5' },
    { glow: '#ffd45a', core: '#fff3c0' },
    { glow: '#ffe9c7', core: '#fffaf0' }
  ];

  function hexRgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function makeSprite(hex) {
    var s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    var g = c.getContext('2d'), rgb = hexRgb(hex);
    var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    var col = rgb[0] + ',' + rgb[1] + ',' + rgb[2];
    gr.addColorStop(0, 'rgba(' + col + ',.95)');
    gr.addColorStop(.25, 'rgba(' + col + ',.42)');
    gr.addColorStop(.6, 'rgba(' + col + ',.10)');
    gr.addColorStop(1, 'rgba(' + col + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    return c;
  }
  var sprites = PAL.map(function (p) { return makeSprite(p.glow); });

  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function hash(i, x) {
    var s = Math.sin(i * 12.9898 + x * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  var W, H, dpr, unit, block, planeY, bulbs = [], paths = [];
  var tar = new Float32Array(0), cur = new Float32Array(0);

  function build() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var LW = 4, LH = 6, G = W < 600 ? 1.2 : 1.6, LG = 3.4;
    function wOf(s) { return s.length * LW + (s.length - 1) * G; }

    // Leave a gap above the words, and keep clear of the plug below.
    var zt = zone.getBoundingClientRect().top;
    var topGap = Math.max(56, H * 0.12);
    var availH = Math.max(120, zt - 70 - topGap);
    function fit(ls) {
      var mw = Math.max.apply(null, ls.map(wOf));
      var th = ls.length * LH + (ls.length - 1) * LG;
      return { lines: ls, maxW: mw, totH: th, unit: Math.min(W * 0.92 / mw, availH / th, 34) };
    }
    // Two lines (HAPPY / BIRTHDAY) whenever the letters stay a readable size.
    // On narrow screens, split into HAPPY / BIRTH / DAY only if that makes the letters bigger.
    var two = fit(['HAPPY', 'BIRTHDAY']), three = fit(['HAPPY', 'BIRTH', 'DAY']);
    var pick = (two.unit < 11 && three.unit > two.unit) ? three : two;
    var lines = pick.lines, maxW = pick.maxW, totH = pick.totH;
    unit = pick.unit;
    var bw = maxW * unit, bh = totH * unit;
    var y0 = topGap + (availH - bh) / 2;
    block = { cx: W / 2, top: y0, bottom: y0 + bh, w: bw, h: bh };
    planeY = Math.min(H - 100, Math.max(block.bottom + 70, (block.bottom + H) / 2));
    pcap.style.top = (planeY + 54) + 'px';

    var rnd = mulberry(1234);
    bulbs = []; paths = [];
    var S = unit;
    var r = Math.max(2.2, Math.min(6, unit * 0.2));

    lines.forEach(function (line, li) {
      var lx = (W - wOf(line) * unit) / 2;
      var ly = y0 + li * (LH + LG) * unit;
      for (var ci = 0; ci < line.length; ci++) {
        var ox = lx + ci * (LW + G) * unit;
        var local = [];
        GLYPH[line[ci]].forEach(function (stroke) {
          var pts = stroke.map(function (p) { return [ox + p[0] * unit, ly + p[1] * unit]; });
          paths.push(pts);
          function add(x, y) {
            for (var k = 0; k < local.length; k++) {
              if (Math.hypot(local[k][0] - x, local[k][1] - y) < S * 0.5) return;
            }
            local.push([x, y]);
          }
          for (var i = 0; i < pts.length - 1; i++) {
            var a = pts[i], b = pts[i + 1];
            var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            var n = Math.max(1, Math.round(len / S));
            for (var k2 = 0; k2 < n; k2++) add(a[0] + (b[0] - a[0]) * k2 / n, a[1] + (b[1] - a[1]) * k2 / n);
          }
          var last = pts[pts.length - 1];
          add(last[0], last[1]);
        });
        local.forEach(function (p) {
          bulbs.push({
            x: p[0], y: p[1], r: r,
            c: bulbs.length % PAL.length,
            d: rnd()
          });
        });
      }
    });

    tar = new Float32Array(bulbs.length);
    cur = new Float32Array(bulbs.length);
  }

  // Before the plug: the lights try to start. Each try, a few scattered bulbs
  // stutter on and off, then give up. Never enough at once to read the letters.
  // [start s, length s, share of bulbs, strength]
  var ATT = [
    [.7, .12, .08, .45], [1.1, .18, .10, .50], [1.55, .10, .12, .40],
    [1.9, .30, .16, .55], [2.45, .14, .14, .45], [2.8, .40, .22, .60],
    [3.4, .12, .12, .40], [3.65, .55, .24, .65]
  ];
  function dyingTargets(t) {
    var slice = Math.floor(t * 28);
    for (var k = 0; k < ATT.length; k++) {
      var a = ATT[k], u = (t - a[0]) / a[1];
      if (u < 0 || u > 1) continue;
      var onP = .75 * (1 - .75 * u);
      for (var i = 0; i < bulbs.length; i++) {
        if (hash(i, k * 7.3) >= a[2]) continue;
        if (hash(i, slice + k * 31.7) < onP) {
          var v = a[3] * (.55 + .45 * hash(i, slice * 1.7));
          if (v > tar[i]) tar[i] = v;
        }
      }
    }
  }

  // After the plug: the lights stutter on and off, a bit more each time, then catch and stay on, steady.
  var FL = [[0, .05], [.12, .2], [.3, .36], [.5, .62], [.72, .78], [.9, 1.15], [1.25, 1.32]];
  function lightTarget(i, b, tl) {
    if (reduce) return clamp(tl / .6);
    var s = tl - b.d * .5;
    if (s < 0) return 0;
    if (s >= 1.4) return 1;
    var on = false;
    for (var k = 0; k < FL.length; k++) {
      if (s >= FL[k][0] && s <= FL[k][1]) { on = true; break; }
    }
    if (!on) return 0;
    var sl = Math.floor(s * 30);
    if (hash(i, sl + 99) < .22) return 0;
    return (.45 + .55 * hash(i, sl)) * (.6 + .4 * (s / 1.4));
  }

  // Once lit, now and then a few bulbs stutter off and on, like a loose connection.
  var loose = [], nextLoose = 0;
  function looseFlicker(now, n) {
    if (reduce || !n) return;
    if (nextLoose === 0) nextLoose = now + 1200;
    if (now >= nextLoose) {
      var k = 1 + Math.floor(Math.random() * 3);
      for (var j = 0; j < k; j++) {
        loose.push({
          i: Math.floor(Math.random() * n),
          t: now + Math.random() * 220,
          dur: 220 + Math.random() * 380,
          seed: Math.random() * 100
        });
      }
      nextLoose = now + 1500 + Math.random() * 2500;
    }
    var slice = Math.floor(now / 55);
    for (var m = loose.length - 1; m >= 0; m--) {
      var f = loose[m], u = (now - f.t) / f.dur;
      if (u >= 1) { loose.splice(m, 1); continue; }
      if (u < 0) continue;
      tar[f.i] = hash(f.i, slice + f.seed) < .55 * (1 - u * .6) ? .12 : 1;
    }
  }

  var state = 'dying', t0 = performance.now(), tl0 = 0, litAt = 0, cordA = .15, planeStarted = false;

  function frame(now) {
    var t = (now - t0) / 1000, tl = 0, lit = 0, i;
    if (state === 'dying' && t > (reduce ? 1.0 : 4.9)) {
      state = 'waiting';
      zone.classList.add('show');
      plug.disabled = false;
    }
    if (state === 'lighting' || state === 'lit') {
      tl = (now - tl0) / 1000;
      if (state === 'lighting' && tl > 2.4) { state = 'lit'; litAt = now; }
      lit = Math.min(1, tl / .5);
    }
    if (state === 'lit' && !planeStarted && now - litAt > 3200) {
      planeStarted = true;
      zone.classList.add('gone');
      startPlane();
    }
    var target = planeStarted ? 0 : state === 'dying' ? .15 : state === 'lit' || state === 'lighting' ? .85 : .6;
    cordA += (target - cordA) * .04;

    var n = bulbs.length;
    tar.fill(0);
    if (state === 'dying') {
      if (!reduce) dyingTargets(t);
    } else if (state === 'lighting' || state === 'lit') {
      for (i = 0; i < n; i++) tar[i] = lightTarget(i, bulbs[i], tl);
      if (state === 'lit') looseFlicker(now, n);
    }
    // filament response: quick to light, a touch slower to fade
    for (i = 0; i < n; i++) cur[i] += (tar[i] - cur[i]) * (tar[i] > cur[i] ? .75 : .4);

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // letter wires, only visible once the lights are on
    if (lit > 0) {
      ctx.strokeStyle = '#3b2d20';
      ctx.lineWidth = Math.max(1, unit * .06);
      ctx.globalAlpha = .6 * lit;
      ctx.beginPath();
      paths.forEach(function (p) {
        ctx.moveTo(p[0][0], p[0][1]);
        for (var q = 1; q < p.length; q++) ctx.lineTo(p[q][0], p[q][1]);
      });
      ctx.stroke();
    }

    // cord down to the plug
    if (cordA > .01) {
      var pr = plug.getBoundingClientRect();
      var sx = block.cx, sy = block.bottom + unit * 1.2;
      var ex = pr.left + pr.width / 2, ey = pr.top + 2;
      var d = Math.hypot(ex - sx, ey - sy);
      ctx.globalAlpha = cordA;
      ctx.strokeStyle = '#2f241a';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(sx, sy + d * .35, ex, ey - d * .35, ex, ey);
      ctx.stroke();
    }

    // unlit glass: effectively invisible until the lights are on
    ctx.globalAlpha = .02 + .08 * lit;
    ctx.fillStyle = '#96704a';
    for (i = 0; i < n; i++) {
      var b0 = bulbs[i];
      ctx.beginPath(); ctx.arc(b0.x, b0.y, b0.r * .7, 0, 6.283); ctx.fill();
    }

    // soft warmth around the words
    ctx.globalCompositeOperation = 'lighter';
    if (lit > 0) {
      var cx = block.cx, cy = block.top + block.h / 2, rad = Math.max(block.w, block.h) * .75;
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, 'rgba(255,160,70,' + (.05 * lit) + ')');
      g.addColorStop(1, 'rgba(255,160,70,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // glow
    for (i = 0; i < n; i++) {
      var v = cur[i];
      if (v < .01) continue;
      var bb = bulbs[i], sp = sprites[bb.c];
      var D = bb.r * 8 * (.6 + .4 * v);
      ctx.globalAlpha = Math.min(1, v);
      ctx.drawImage(sp, bb.x - D / 2, bb.y - D / 2, D, D);
      var D2 = bb.r * 16;
      ctx.globalAlpha = v * .12;
      ctx.drawImage(sp, bb.x - D2 / 2, bb.y - D2 / 2, D2, D2);
    }

    // bulb bodies
    ctx.globalCompositeOperation = 'source-over';
    for (i = 0; i < n; i++) {
      var w = cur[i];
      if (w < .02) continue;
      var bk = bulbs[i];
      ctx.globalAlpha = Math.min(1, w * 1.1);
      ctx.fillStyle = PAL[bk.c].glow;
      ctx.beginPath(); ctx.arc(bk.x, bk.y, bk.r * .8, 0, 6.283); ctx.fill();
      ctx.fillStyle = PAL[bk.c].core;
      ctx.beginPath(); ctx.arc(bk.x, bk.y, bk.r * .4, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  // ---- paper plane ----
  // It glides in from the left in a gentle wave that settles as it reaches the middle,
  // pitching along its path, then floats in place waiting to be opened.
  var pstate = 'idle', pStart = 0, FLIGHT = 3800;
  function smooth(a, b, x) { var u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); }
  function pathAt(s) {
    var amp = 34 * Math.min(1, W / 700);
    return {
      x: -100 + (W / 2 + 100) * s,
      y: planeY - 80 * (1 - s) + amp * Math.sin(s * 6) * Math.pow(1 - s, 1.1)
    };
  }
  function setPlane(x, y, rot) {
    plane.style.transform = 'translate(' + (x - 48) + 'px,' + (y - 32) + 'px) rotate(' + rot + 'deg)';
  }
  function startPlane() {
    pStart = performance.now();
    var p0 = pathAt(0);
    setPlane(p0.x, p0.y, 0);
    plane.classList.add('on');
    pstate = reduce ? 'hover' : 'flying';
    if (reduce) { plane.classList.add('ready'); pcap.classList.add('show'); }
    requestAnimationFrame(planeLoop);
  }
  function planeLoop(now) {
    var p = reduce ? 1 : (now - pStart) / FLIGHT, x, y, rot;
    if (p < 1) {
      var s = Math.sin(p * Math.PI / 2);
      var pt = pathAt(s), a = pathAt(Math.max(0, s - .002)), b = pathAt(Math.min(1, s + .002));
      var ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI * .85;
      rot = ang + (3 - ang) * smooth(.75, 1, s);
      x = pt.x; y = pt.y;
    } else {
      if (pstate === 'flying') {
        pstate = 'hover';
        plane.classList.add('ready');
        pcap.classList.add('show');
      }
      x = W / 2; y = planeY + Math.sin(now / 800) * 4; rot = 3 + Math.sin(now / 1100) * 2;
    }
    setPlane(x, y, rot);
    requestAnimationFrame(planeLoop);
  }

  function openNote() {
    if (pstate !== 'hover') return;
    pstate = 'open';
    plane.classList.add('away');
    plane.classList.remove('ready');
    pcap.classList.remove('show');
    dim.classList.add('on');
    note.classList.add('open');
    note.setAttribute('aria-hidden', 'false');
  }
  function closeNote() {
    if (pstate !== 'open') return;
    pstate = 'hover';
    note.classList.remove('open');
    note.setAttribute('aria-hidden', 'true');
    dim.classList.remove('on');
    plane.classList.remove('away');
    plane.classList.add('ready');
    pcap.classList.add('show');
  }
  plane.addEventListener('click', openNote);
  closeBtn.addEventListener('click', closeNote);
  dim.addEventListener('click', closeNote);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNote(); });

  plug.addEventListener('click', function () {
    if (state !== 'waiting') return;
    playSong();
    state = 'plugging';
    plug.disabled = true;
    plug.classList.add('in');
    zone.classList.add('done');
    setTimeout(function () { state = 'lighting'; tl0 = performance.now(); }, reduce ? 0 : 780);
  });

  window.addEventListener('resize', build);
  build();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  requestAnimationFrame(frame);
})();