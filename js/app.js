/* ============================================================
   Tokomekari — Logo Remove Background
   js/app.js — Logika antarmuka (UI)
   - Terima JPG / JPEG / PNG / PDF (PDF dirender via PDF.js)
   - Mode offline: Warna Latar Otomatis & Klik Warna (magic wand)
   - Mode online : AI (@imgly/background-removal via CDN)
   - Hasil akhir selalu PNG transparan
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- Referensi elemen ---------------- */
  const $ = (s) => document.querySelector(s);
  const uploadSection = $('#uploadSection');
  const editorSection = $('#editorSection');
  const dropzone = $('#dropzone');
  const fileInput = $('#fileInput');
  const btnSample = $('#btnSample');
  const fileMeta = $('#fileMeta');
  const origCanvas = $('#origCanvas');
  const resCanvas = $('#resCanvas');
  const resPlaceholder = $('#resPlaceholder');
  const btnProcess = $('#btnProcess');
  const btnDownload = $('#btnDownload');
  const btnReset = $('#btnReset');
  const btnNew = $('#btnNew');
  const tolRange = $('#tolRange');
  const tolVal = $('#tolVal');
  const featherRange = $('#featherRange');
  const featherVal = $('#featherVal');
  const modeInputs = document.querySelectorAll('input[name="mode"]');
  const wandHint = $('#wandHint');
  const sliderBox = $('#sliderBox');
  const aiNote = $('#aiNote');
  const statusBox = $('#status');
  const statusText = $('#statusText');
  const spinner = $('#spinner');
  const progressWrap = $('#progressWrap');
  const progressBar = $('#progressBar');
  const zoomSelect = $('#zoomSelect');
  const pdfBar = $('#pdfBar');
  const pdfPageSel = $('#pdfPage');

  const MAX_DIM = 2600;      // sisi terpanjang gambar kerja (performa)
  const PDF_DIM = 2200;      // target sisi terpanjang hasil render PDF
  const ACCEPT_EXT = ['jpg', 'jpeg', 'png', 'pdf'];
  const PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const AI_MODULE = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm';

  const state = {
    srcCanvas: null,
    srcName: 'gambar',
    mode: 'auto',
    tolerance: Number(tolRange.value),
    feather: Number(featherRange.value),
    pdfDoc: null,
    resultReady: false,
    lastWandSeed: null
  };

  /* ---------------- Status & util tampilan ---------------- */
  function showStatus(msg, kind) {
    statusBox.hidden = false;
    statusBox.className = 'status ' + (kind || 'info');
    statusText.textContent = msg;
  }

  function setBusy(on) {
    spinner.hidden = !on;
    btnProcess.disabled = on || !state.srcCanvas;
    if (on) { btnDownload.disabled = true; btnReset.disabled = true; }
  }

  function showProgress(pct) {
    if (pct == null) { progressWrap.hidden = true; return; }
    progressWrap.hidden = false;
    progressBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }

  function applyZoom() {
    const v = zoomSelect.value;
    [origCanvas, resCanvas].forEach((c) => {
      if (!c.width) return;
      if (v === 'fit') { c.style.width = ''; c.classList.remove('zoomed'); }
      else { c.style.width = Math.round(c.width * parseFloat(v)) + 'px'; c.classList.add('zoomed'); }
    });
  }

  function readCanvas(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { w: canvas.width, h: canvas.height, data: img.data };
  }

  /* ---------------- Muat file ---------------- */
  function extOf(name) { return (name.split('.').pop() || '').toLowerCase(); }
  function baseOf(name) { return name.replace(/\.[^.]+$/, ''); }

  async function handleFile(file, forcedName) {
    if (!file) return;
    const name = forcedName || file.name || 'gambar-tempel.png';
    const ext = extOf(name);
    const ok = ACCEPT_EXT.includes(ext) ||
      ['image/jpeg', 'image/png', 'application/pdf'].includes(file.type);
    if (!ok) {
      showStatus('Format tidak didukung: ' + name + '. Gunakan JPG, JPEG, PNG, atau PDF.', 'error');
      return;
    }
    const isPdf = ext === 'pdf' || file.type === 'application/pdf';
    showStatus('Memuat ' + name + ' …', 'info');
    try {
      if (isPdf) await loadPdf(file, name);
      else {
        let bmp;
        try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
        catch (e) { bmp = await loadViaImageTag(file); }
        const { canvas, scaled } = bitmapToCanvas(bmp);
        setSource(canvas, baseOf(name), scaled ? ' · diperkecil untuk performa' : '');
      }
    } catch (err) {
      console.error(err);
      showStatus('Gagal membuka file: ' + err.message, 'error');
    }
  }

  function loadViaImageTag(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak dapat dibaca.')); };
      img.src = url;
    });
  }

  function bitmapToCanvas(bmp) {
    const w = bmp.width || bmp.naturalWidth;
    const h = bmp.height || bmp.naturalHeight;
    const scale = Math.min(1, MAX_DIM / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    c.getContext('2d').drawImage(bmp, 0, 0, cw, ch);
    if (bmp.close) bmp.close();
    return { canvas: c, scaled: scale < 1 };
  }

  /* ---------------- PDF ---------------- */
  async function loadPdf(file, name) {
    if (!window.pdfjsLib) {
      throw new Error('Pustaka PDF.js belum termuat. File PDF memerlukan koneksi internet (memuat PDF.js dari CDN).');
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
    if (state.pdfDoc) { try { state.pdfDoc.destroy(); } catch (e) { /* abaikan */ } }
    const buf = await file.arrayBuffer();
    state.pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
    state.srcName = baseOf(name);

    pdfPageSel.innerHTML = '';
    for (let p = 1; p <= state.pdfDoc.numPages; p++) {
      const opt = document.createElement('option');
      opt.value = String(p);
      opt.textContent = 'Halaman ' + p + ' / ' + state.pdfDoc.numPages;
      pdfPageSel.appendChild(opt);
    }
    pdfBar.hidden = state.pdfDoc.numPages <= 1 ? true : false;
    await renderPdfPage(1);
  }

  async function renderPdfPage(num) {
    const page = await state.pdfDoc.getPage(num);
    const vp1 = page.getViewport({ scale: 1 });
    const scale = Math.min(6, Math.max(0.5, PDF_DIM / Math.max(vp1.width, vp1.height)));
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.ceil(vp.width);
    c.height = Math.ceil(vp.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    setSource(c, state.srcName + '-hal' + num);
  }

  /* ---------------- Set sumber gambar ---------------- */
  function setSource(canvas, label, extra) {
    state.srcCanvas = canvas;
    if (label) state.srcName = label;

    origCanvas.width = canvas.width;
    origCanvas.height = canvas.height;
    origCanvas.getContext('2d').drawImage(canvas, 0, 0);

    resetResult();
    uploadSection.hidden = true;
    editorSection.hidden = false;
    if (!state.pdfDoc) pdfBar.hidden = true;
    fileMeta.textContent = '📄 ' + state.srcName + ' — ' + canvas.width + '×' + canvas.height + ' px' + (extra || '');
    applyZoom();
    editorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Mode otomatis langsung diproses agar pengguna langsung melihat hasil
    if (state.mode === 'auto') process();
    else showStatus('File siap. Pilih mode lalu klik "Hapus Latar".', 'info');
  }

  /* ---------------- Pemrosesan ---------------- */
  async function process() {
    if (!state.srcCanvas) return;
    if (state.mode === 'ai') return processAI();

    if (state.mode === 'wand' && !state.lastWandSeed) {
      showStatus('Mode klik warna: klik dulu warna latar pada gambar ASLI (kiri).', 'warn');
      return;
    }

    setBusy(true);
    showProgress(null);
    showStatus('Memproses…', 'info');
    await new Promise((r) => setTimeout(r, 30)); // beri kesempatan spinner tampil
    const t0 = performance.now();

    try {
      const { w, h, data } = readCanvas(state.srcCanvas);
      const R = window.RemoveBG;
      const tol = state.tolerance * 2.2; // 0..220 (skala jarak warna)

      let seeds, ref;
      if (state.mode === 'wand') {
        const { x, y } = state.lastWandSeed;
        const o = (y * w + x) * 4;
        ref = [data[o], data[o + 1], data[o + 2]];
        seeds = [[x, y]];
      } else {
        ref = R.estimateBackground(data, w, h);
        seeds = 'border';
      }

      const removed = R.removeSimilar(data, w, h, { seeds: seeds, ref: ref, tolerance: tol });
      const alpha = R.buildAlpha(removed, w, h, state.feather);
      const out = R.applyResult(data, w, h, alpha, ref);
      paintResult(out, w, h);

      const dt = ((performance.now() - t0) / 1000).toFixed(2);
      const pct = Math.round((removed.reduce((a, b) => a + b, 0) / removed.length) * 100);
      showStatus('Selesai dalam ' + dt + ' dtk — ' + pct + '% area menjadi transparan. Periksa hasilnya lalu klik "Unduh PNG".', 'success');
    } catch (err) {
      console.error(err);
      showStatus('Terjadi kesalahan: ' + err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function processAI() {
    setBusy(true);
    showProgress(0);
    showStatus('Memuat modul AI… (butuh internet)', 'info');
    try {
      const mod = await import(AI_MODULE);
      const cfg = {
        progress: (key, current, total) => {
          const pct = total ? Math.round((current / total) * 100) : 0;
          showProgress(pct);
          statusText.textContent = 'AI sedang bekerja: ' + pct + '% (' + String(key).split(':')[0] + ')';
        }
      };
      const inBlob = await new Promise((r) => state.srcCanvas.toBlob(r, 'image/png'));
      showStatus('AI sedang menghapus latar… unduhan model hanya dilakukan sekali, lalu di-cache.', 'info');
      const outBlob = await mod.removeBackground(inBlob, cfg);
      const bmp = await createImageBitmap(outBlob);
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
      if (bmp.close) bmp.close();
      const { w, h, data } = readCanvas(c);
      const out = new Uint8ClampedArray(data);
      paintResult(out, w, h);
      showProgress(null);
      showStatus('Selesai! Latar dihapus oleh AI. Periksa hasilnya lalu klik "Unduh PNG".', 'success');
    } catch (err) {
      console.error(err);
      showProgress(null);
      showStatus('Mode AI gagal (' + err.message + '). Coba mode offline: "Warna Latar Otomatis" atau "Klik Warna".', 'error');
    } finally {
      setBusy(false);
    }
  }

  function paintResult(rgba, w, h) {
    resCanvas.width = w;
    resCanvas.height = h;
    const ctx = resCanvas.getContext('2d');
    ctx.putImageData(new ImageData(rgba, w, h), 0, 0);
    resPlaceholder.hidden = true;
    state.resultReady = true;
    btnDownload.disabled = false;
    btnReset.disabled = false;
    applyZoom();
  }

  function resetResult() {
    const ctx = resCanvas.getContext('2d');
    ctx.clearRect(0, 0, resCanvas.width, resCanvas.height);
    resPlaceholder.hidden = false;
    state.resultReady = false;
    btnDownload.disabled = true;
    btnReset.disabled = true;
  }

  function downloadResult() {
    if (!state.resultReady) return;
    resCanvas.toBlob((blob) => {
      if (!blob) { showStatus('Gagal membuat PNG.', 'error'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safe = (state.srcName || 'gambar').replace(/[^\w\-]+/g, '-');
      a.href = url;
      a.download = safe + '-transparan.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      showStatus('PNG transparan berhasil diunduh ✅', 'success');
    }, 'image/png');
  }

  function newImage() {
    if (state.pdfDoc) { try { state.pdfDoc.destroy(); } catch (e) { /* abaikan */ } state.pdfDoc = null; }
    state.srcCanvas = null;
    state.lastWandSeed = null;
    fileInput.value = '';
    pdfBar.hidden = true;
    editorSection.hidden = true;
    uploadSection.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- Interaksi kanvas (magic wand) ---------------- */
  function eventToCanvas(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * canvas.width / rect.width);
    const y = Math.round((e.clientY - rect.top) * canvas.height / rect.height);
    return {
      x: Math.max(0, Math.min(canvas.width - 1, x)),
      y: Math.max(0, Math.min(canvas.height - 1, y))
    };
  }

  origCanvas.addEventListener('click', (e) => {
    if (state.mode !== 'wand' || !state.srcCanvas) return;
    state.lastWandSeed = eventToCanvas(e, origCanvas);
    wandHint.innerHTML = 'Titik warna: (' + state.lastWandSeed.x + ', ' + state.lastWandSeed.y +
      '). Klik warna latar lain untuk hasil berbeda.';
    process();
  });

  /* ---------------- Reaktif: slider & mode ---------------- */
  let debounce = null;
  function scheduleReprocess() {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (state.resultReady && state.mode !== 'ai') process();
    }, 180);
  }

  tolRange.addEventListener('input', () => {
    state.tolerance = Number(tolRange.value);
    tolVal.textContent = tolRange.value;
    scheduleReprocess();
  });

  featherRange.addEventListener('input', () => {
    state.feather = Number(featherRange.value);
    featherVal.textContent = featherRange.value;
    scheduleReprocess();
  });

  modeInputs.forEach((input) => {
    input.addEventListener('change', () => {
      state.mode = input.value;
      wandHint.hidden = state.mode !== 'wand';
      aiNote.hidden = state.mode !== 'ai';
      sliderBox.classList.toggle('disabled', state.mode === 'ai');
      btnProcess.textContent = state.mode === 'ai' ? '✨ Hapus Latar (AI)' : '🪄 Hapus Latar';
      if (state.mode === 'wand') {
        state.lastWandSeed = null;
        wandHint.innerHTML = 'Klik warna latar pada gambar <b>Asli</b> (kiri) untuk menghapusnya.';
      }
      // Mode otomatis: langsung proses ulang bila ada gambar
      if (state.mode === 'auto' && state.srcCanvas) process();
    });
  });

  /* ---------------- Tombol ---------------- */
  btnProcess.addEventListener('click', process);
  btnDownload.addEventListener('click', downloadResult);
  btnReset.addEventListener('click', () => {
    resetResult();
    showStatus('Hasil dihapus. Klik "Hapus Latar" untuk memproses ulang.', 'info');
  });
  btnNew.addEventListener('click', newImage);
  zoomSelect.addEventListener('change', applyZoom);
  pdfPageSel.addEventListener('change', async () => {
    await renderPdfPage(Number(pdfPageSel.value));
  });

  /* ---------------- Pemilihan file ---------------- */
  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  ['dragenter', 'dragover'].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); }));

  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  window.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file') { handleFile(item.getAsFile(), 'gambar-tempel.png'); return; }
    }
  });

  btnSample.addEventListener('click', async () => {
    try {
      const res = await fetch('assets/sample-logo.png');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      handleFile(new File([blob], 'contoh-logo-tokomekari.png', { type: 'image/png' }));
    } catch (err) {
      showStatus('Gambar contoh tidak dapat dimuat (perlu dijalankan lewat server/web hosting).', 'error');
    }
  });
})();
