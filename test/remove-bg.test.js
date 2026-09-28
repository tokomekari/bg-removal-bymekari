/* Pengujian cepat algoritma remove background (jalankan: node test/remove-bg.test.js) */
'use strict';
const assert = require('node:assert');
const R = require('../js/remove-bg.js');

function makeImage(w, h, fn) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fn(x, y);
      const o = (y * w + x) * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a;
    }
  }
  return d;
}

// Kanvas 40x40: latar putih, kotak merah 12..27 (logo sederhana)
const w = 40, h = 40;
const inRed = (x, y) => x >= 12 && x <= 27 && y >= 12 && y <= 27;
const data = makeImage(w, h, (x, y) => inRed(x, y) ? [220, 30, 30, 255] : [255, 255, 255, 255]);

// 1) Estimasi warna latar = putih
const bg = R.estimateBackground(data, w, h);
assert.deepStrictEqual(bg, [255, 255, 255], 'warna latar harus putih');

// 2) Flood fill dari tepi: sudut terhapus, kotak merah utuh
const removed = R.removeSimilar(data, w, h, { seeds: 'border', ref: bg, tolerance: 44 });
const at = (x, y) => removed[y * w + x];
assert.strictEqual(at(0, 0), 1, 'sudut kiri-atas harus terhapus');
assert.strictEqual(at(39, 39), 1, 'sudut kanan-bawah harus terhapus');
assert.strictEqual(at(20, 20), 0, 'tengah kotak merah harus dipertahankan');
assert.strictEqual(at(12, 12), 0, 'sudut kotak merah harus dipertahankan');

// 3) Magic wand: seed di (0,0) tidak menembus kotak merah
const removed2 = R.removeSimilar(data, w, h, { seeds: [[0, 0]], ref: [255, 255, 255], tolerance: 44 });
assert.strictEqual(removed2[20 * w + 20], 0, 'wand tidak boleh menembus kotak merah');

// 4) Alpha tanpa feather: keras (0/1)
const alpha = R.buildAlpha(removed, w, h, 0);
assert.strictEqual(alpha[0], 0);
assert.strictEqual(alpha[20 * w + 20], 1);

// 5) Feather 2px tidak memakan subjek (pusat tetap buram penuh)
const alphaF = R.buildAlpha(removed, w, h, 2);
assert.strictEqual(alphaF[20 * w + 20], 1, 'feather tidak boleh mengikis pusat subjek');
assert.ok(alphaF[12 * w + 12] < 1, 'tepat di tepi kotak, alpha harus < 1 setelah feather');

// 6) Hasil akhir: sudut transparan; pusat merah buram
const out = R.applyResult(data, w, h, alpha, bg);
assert.strictEqual(out[3], 0, 'alpha sudut harus 0');
const c = (20 * w + 20) * 4;
assert.strictEqual(out[c + 3], 255, 'alpha pusat harus 255');
assert.ok(out[c] > 180 && out[c + 1] < 80, 'warna pusat harus tetap kemerahan');

// 7) Gambar yang sudah transparan: area alpha=0 ikut terhapus
const tData = makeImage(10, 10, (x, y) => (x < 2 ? [0, 0, 0, 0] : [200, 200, 200, 255]));
const tRemoved = R.removeSimilar(tData, 10, 10, { seeds: 'border', ref: [200, 200, 200], tolerance: 10 });
assert.strictEqual(tRemoved[5], 1, 'kolom transparan harus ikut terhapus');

console.log('✔ Semua pengujian remove-bg lulus (' + 7 + ' skenario)');
