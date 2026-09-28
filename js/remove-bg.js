/* ============================================================
   Tokomekari — Logo Remove Background
   js/remove-bg.js — Algoritma penghapus latar (murni, tanpa DOM)
   Bisa dipakai di browser (window.RemoveBG) maupun Node.js (require).
   ============================================================ */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RemoveBG = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

  /* Selisih warna kuadrat (Euclidean^2) antara piksel i dan warna c=[r,g,b] */
  function colorDist2(data, i, c) {
    const o = i * 4;
    const dr = data[o] - c[0];
    const dg = data[o + 1] - c[1];
    const db = data[o + 2] - c[2];
    return dr * dr + dg * dg + db * db;
  }

  /* Median satu kanal dari daftar sampel */
  function median(arr) {
    arr.sort((a, b) => a - b);
    const m = arr.length >> 1;
    return arr.length % 2 ? arr[m] : Math.round((arr[m - 1] + arr[m]) / 2);
  }

  /**
   * Perkirakan warna latar dengan mengambil median piksel di sepanjang tepi.
   * Median tahan terhadap objek yang menyentuh sebagian tepi.
   */
  function estimateBackground(data, w, h) {
    const rs = [], gs = [], bs = [];
    const step = Math.max(1, Math.floor(Math.max(w, h) / 90));
    const take = (x, y) => {
      const o = (y * w + x) * 4;
      if (data[o + 3] < 16) return; // abaikan piksel yang sudah transparan
      rs.push(data[o]); gs.push(data[o + 1]); bs.push(data[o + 2]);
    };
    for (let x = 0; x < w; x += step) { take(x, 0); take(x, h - 1); }
    for (let y = 0; y < h; y += step) { take(0, y); take(w - 1, y); }
    if (!rs.length) return [255, 255, 255]; // fallback: putih
    return [median(rs), median(gs), median(bs)];
  }

  /**
   * Hapus area berwarna serupa (flood-fill BFS 4-arah).
   * opts.seeds: 'border' (semua piksel tepi) atau array [[x,y], ...]
   * opts.ref:   warna acuan [r,g,b]
   * opts.tolerance: jarak warna maksimum (0..~441)
   * Mengembalikan Uint8Array (1 = terhapus/latar, 0 = dipertahankan).
   * Piksel yang memang sudah transparan (alpha<128) ikut dihapus & menjadi penghubung.
   */
  function removeSimilar(data, w, h, opts) {
    const tol = opts.tolerance || 30;
    const tol2 = tol * tol;
    const ref = opts.ref;
    const removed = new Uint8Array(w * h);
    const stack = [];

    const trySeed = (i) => {
      if (removed[i]) return;
      if (data[i * 4 + 3] < 128 || colorDist2(data, i, ref) <= tol2) {
        removed[i] = 1;
        stack.push(i);
      }
    };

    if (opts.seeds === 'border') {
      for (let x = 0; x < w; x++) { trySeed(x); trySeed((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { trySeed(y * w); trySeed(y * w + w - 1); }
    } else {
      for (const [x, y] of opts.seeds) {
        if (x >= 0 && x < w && y >= 0 && y < h) trySeed(y * w + x);
      }
    }

    const visit = (n) => {
      if (removed[n]) return;
      if (data[n * 4 + 3] < 128 || colorDist2(data, n, ref) <= tol2) {
        removed[n] = 1;
        stack.push(n);
      }
    };

    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      const y = (i / w) | 0;
      if (x > 0) visit(i - 1);
      if (x < w - 1) visit(i + 1);
      if (y > 0) visit(i - w);
      if (y < h - 1) visit(i + w);
    }

    return removed;
  }

  /* Erosi 8-tetangga pada mask (1 = foreground yang dipertahankan) */
  function erode8(keep, w, h) {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!keep[i]) continue;
        let ok = 1;
        for (let dy = -1; dy <= 1 && ok; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) { ok = 0; break; }
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w || !keep[yy * w + xx]) { ok = 0; break; }
          }
        }
        out[i] = ok;
      }
    }
    return out;
  }

  /* Box blur 3x3 separable untuk Float32Array */
  function boxBlur3(src, w, h) {
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const xm = x > 0 ? x - 1 : x;
        const xp = x < w - 1 ? x + 1 : x;
        tmp[row + x] = (src[row + xm] + src[row + x] + src[row + xp]) / 3;
      }
    }
    for (let y = 0; y < h; y++) {
      const ym = (y > 0 ? y - 1 : y) * w;
      const yp = (y < h - 1 ? y + 1 : y) * w;
      const yc = y * w;
      for (let x = 0; x < w; x++) {
        out[yc + x] = (tmp[ym + x] + tmp[yc + x] + tmp[yp + x]) / 3;
      }
    }
    return out;
  }

  /**
   * Bangun peta alpha (0..1) dari mask terhapus.
   * feather: 0 = tajam; 1..4 = tepi semakin halus (erosi + blur),
   * sehingga sisa pinggiran warna latar (fringe) ikut terpotong rapi.
   */
  function buildAlpha(removed, w, h, feather) {
    let keep = new Uint8Array(w * h);
    for (let i = 0; i < keep.length; i++) keep[i] = removed[i] ? 0 : 1;

    const r = Math.max(0, Math.min(4, feather | 0));
    for (let it = 0; it < r; it++) keep = erode8(keep, w, h);

    let alpha = Float32Array.from(keep);
    if (r > 0) {
      alpha = boxBlur3(alpha, w, h);
      if (r >= 3) alpha = boxBlur3(alpha, w, h);
    }
    return alpha;
  }

  /**
   * Gabungkan alpha dengan warna asli → RGBA final.
   * Piksel semi-transparan di tepi di-"decontaminate": campuran warna latar
   * dikeluarkan dari warna piksel agar tepi tampak bersih di atas latar apa pun.
   */
  function applyResult(data, w, h, alpha, bg) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      const a0 = data[o + 3] / 255;
      const a = alpha[i] * a0;
      if (a <= 0) continue; // rgb & alpha tetap 0 (transparan penuh)

      let r = data[o], g = data[o + 1], b = data[o + 2];
      const ka = alpha[i];
      if (ka > 0.001 && ka < 0.999 && data[o + 3] > 200) {
        r = clamp255(Math.round((r - bg[0] * (1 - ka)) / ka));
        g = clamp255(Math.round((g - bg[1] * (1 - ka)) / ka));
        b = clamp255(Math.round((b - bg[2] * (1 - ka)) / ka));
      }
      out[o] = r; out[o + 1] = g; out[o + 2] = b;
      out[o + 3] = Math.round(a * 255);
    }
    return out;
  }

  return {
    estimateBackground: estimateBackground,
    removeSimilar: removeSimilar,
    buildAlpha: buildAlpha,
    applyResult: applyResult,
    colorDist2: colorDist2
  };
});
