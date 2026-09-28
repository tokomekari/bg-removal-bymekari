# Tokomekari Logo Remove Background

Website statis untuk **menghapus latar belakang logo & foto dengan rapi**, langsung dari browser — tanpa server, tanpa instalasi. Hasil akhir selalu berupa **PNG dengan latar transparan** yang siap diunduh.

![lisensi](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Fitur

| Fitur | Keterangan |
|---|---|
| 📥 Format input | **JPG, JPEG, PNG, dan PDF** (PDF dirender jadi gambar dulu via PDF.js) |
| 🎯 Warna Latar Otomatis | Deteksi warna latar dari tepi gambar lalu hapus (cocok untuk logo berlatar polos) — **offline** |
| 🖱️ Klik Warna (Magic Wand) | Klik warna latar mana pun di gambar untuk menghapusnya — **offline** |
| ✨ Mode AI | Penghapusan paling rapi untuk foto kompleks via `@imgly/background-removal` (butuh internet, model di-cache setelah unduhan pertama) |
| 🎚️ Sensitivitas warna | Atur toleransi warna yang ikut terhapus |
| 🌫️ Kehalusan tepi | Erosi + feather + *decontamination* warna agar tepi bersih tanpa sisa pinggiran (fringe) |
| ⬇️ Unduh PNG | Hasil akhir PNG transparan, nama otomatis `namafile-transparan.png` |
| 📄 Multi-halaman PDF | Pilih halaman PDF yang ingin diproses |
| 📋 Tempel gambar | Dukung paste langsung (Ctrl+V) & drag-and-drop |
| 🔒 Privasi | Semua pemrosesan dilakukan di browser; file tidak dikirim ke server |

---

## 🚀 Menjalankan secara lokal

Cukup buka `index.html` di browser, **atau** (disarankan, agar tombol contoh & PDF berfungsi maksimal) jalankan server statis kecil:

```bash
# Python
python3 -m http.server 8000
# lalu buka http://localhost:8000

# atau Node
npx serve .
```

---

## 🐙 Mengunggah ke GitHub

### Cara 1 — Lewat situs GitHub (tanpa install apa pun)

1. Buka [github.com/new](https://github.com/new) dan buat repository baru, misalnya `tokomekari-bg-remover`.
2. Setelah repo dibuat, klik **Add file → Upload files**.
3. Seret **semua isi folder** `tokomekari-bg-remover` (file `index.html`, folder `css`, `js`, `assets`, `test`, dsb.).
4. Klik **Commit changes**. Selesai ✅

### Cara 2 — Lewat terminal (git)

```bash
cd tokomekari-bg-remover
git init
git add .
git commit -m "Tokomekari Logo Remove Background"
git branch -M main
git remote add origin https://github.com/NAMA-KAMU/tokomekari-bg-remover.git
git push -u origin main
```

### 🌐 Menjadikannya website online (GitHub Pages)

1. Di repo GitHub, buka **Settings → Pages**.
2. Pada **Source**, pilih **Deploy from a branch**.
3. Pilih branch **main** dan folder **/ (root)**, klik **Save**.
4. Tunggu ±1 menit — website aktif di:
   `https://NAMA-KAMU.github.io/tokomekari-bg-remover/`

---

## 🗂️ Struktur proyek

```
tokomekari-bg-remover/
├── index.html              # Halaman utama
├── css/
│   └── style.css           # Tampilan
├── js/
│   ├── remove-bg.js        # Algoritma penghapus latar (murni, tanpa DOM)
│   └── app.js              # Logika UI, PDF.js, mode AI
├── assets/
│   └── sample-logo.png     # Gambar contoh untuk tombol "Coba contoh"
├── test/
│   └── remove-bg.test.js   # Pengujian algoritma (Node.js)
├── package.json
├── LICENSE                 # MIT
└── README.md
```

## 🧪 Menjalankan pengujian

```bash
node test/remove-bg.test.js
# atau
npm test
```

## 🛠️ Teknologi

- HTML + CSS + JavaScript murni (tanpa framework, tanpa build step)
- [PDF.js](https://mozilla.github.io/pdf.js/) — merender file PDF (CDN)
- [@imgly/background-removal](https://github.com/imgly/background-removal-js) — mode AI opsional (CDN)

## 🔒 Privasi

Semua gambar diproses **di perangkat pengguna**. Tidak ada file yang diunggah ke server aplikasi. Mode AI pun berjalan langsung di browser (WebAssembly/ONNX), hanya mengunduh model dari CDN.

## 📄 Lisensi

MIT © 2026 Tokomekari — silakan dipakai dan dimodifikasi.
