# FLAC → AAC Web Converter — Catatan Produksi (Internal)

> Dokumen ini **khusus untuk developer / produksi**.
> Bukan dokumentasi user. Dibuat biar gampang dirawat, di-tweak, dan nggak kejebak bug aneh di device kentang.

---

## Tujuan Build

Web app untuk **convert FLAC ke AAC** langsung di browser menggunakan **FFmpeg WebAssembly** dengan karakter:

* Client-side processing (tanpa server)
* Batch kecil (±10–20 lagu / album)
* Stabil di Android low-end
* Fokus ke kebutuhan personal

Non-goal:

* Background processing
* Batch ratusan file
* Multi-format converter
* Skalabilitas user publik

---

## Arsitektur Tingkat Tinggi

```
Browser / PWA (Foreground ONLY)
 ├─ React UI (minimal)
 ├─ Conversion Engine (Vanilla JS)
 │   ├─ FFmpeg WASM Runtime
 │   └─ Serial Job Queue
 ├─ Virtual FS (in-memory)
 ├─ Wake Lock (screen on)
 └─ Service Worker (cache asset)

Vercel
 └─ Static Asset Hosting
```

Prinsip utama:

> **Selama proses konversi, app HARUS tetap terbuka di foreground.**

---

## Tech Stack

### Frontend

* React (UI only)
* Vanilla JS untuk engine
* ES Modules

Catatan penting:

* React **tidak** menyimpan buffer audio
* Semua proses berat ada di layer non-React

---

### Build Tool

* Vite

Digunakan untuk:

* Dev server
* Static build
* Asset bundling

---

### Media Engine

* `@ffmpeg/ffmpeg`
* `@ffmpeg/util`

Execution model:

* Satu instance FFmpeg
* Proses **serial (satu file per waktu)**
* Cleanup eksplisit tiap file

---

### Hosting

* Vercel (static only)
* Tidak menggunakan Serverless / Edge Function

---

## Konsep WASM (Sudut Pandang Produksi)

* WASM = binary native (C/C++) yang jalan di browser
* FFmpeg dikompilasi via Emscripten
* Jalan di sandbox dengan memory heap sendiri

Implikasi:

* Memory usage besar itu normal
* GC tidak instan
* Cleanup manual itu WAJIB

---

## Resource Budget (Target Realistis)

### Device Target

* Android RAM 3–4 GB
* Browser: Chrome

### Estimasi Peak Memory

| Komponen          | Perkiraan      |
| ----------------- | -------------- |
| FFmpeg WASM Heap  | 128 MB         |
| Decode FLAC (PCM) | 40–80 MB       |
| Output AAC Buffer | 5–10 MB        |
| JS + UI Overhead  | ±20 MB         |
| **Total Peak**    | **200–300 MB** |

Hard rule:

* ❌ Tidak ada parallel processing
* ❌ Tidak simpan banyak file di memory bersamaan

---

## Serial Processing (WAJIB)

### Definisi

Serial processing = **satu file diproses sampai selesai sebelum lanjut file berikutnya**.

DILARANG:

* `Promise.all()`
* Parallel FFmpeg execution

ALUR WAJIB:

```
FLAC 1 → convert → download → cleanup
FLAC 2 → convert → download → cleanup
...
```

Tujuan:

* Menjaga RAM stabil
* Mencegah tab freeze
* Aman untuk Android murah

---

## Auto Download (WAJIB)

Setiap file yang selesai:

1. Output AAC langsung di-trigger download
2. Tidak menunggu batch selesai
3. File input & output langsung dihapus dari FS

Manfaat:

* Kalau app mati di tengah jalan, hasil sebelumnya aman
* Tidak perlu ZIP output (hemat RAM)

---

## Wake Lock (WAJIB)

### Kenapa?

* Android sering mematikan tab saat screen off
* WASM job panjang rawan dibunuh OS

### Kebijakan

* Aktifkan **Wake Lock API** saat proses konversi
* Lepaskan Wake Lock setelah semua job selesai

Catatan:

* Wake Lock bukan jaminan 100%
* Tapi sangat mengurangi risiko proses mati

---

## Service Worker (Langsung Dipakai)

### Tujuan

* WASM hanya download sekali
* Bisa jalan offline setelah load pertama

### Cache Strategy

* Cache First:

  * `ffmpeg-core.wasm`
  * `ffmpeg-core.js`
* Network First:

  * UI JS / HTML

---

## Struktur Folder Produksi

```
/public
  /ffmpeg
    ffmpeg-core.js
    ffmpeg-core.wasm
  sw.js
  manifest.json

/src
  /engine
    ffmpegEngine.js     // logic konversi & WASM
    queue.js            // serial processing
    wakeLock.js         // Wake Lock handler
  /ui
    Converter.jsx
  /utils
    download.js
    deviceCheck.js
  App.jsx
  main.jsx
```

Prinsip:

* `engine/` tidak bergantung React
* UI hanya kirim command & terima progress

---

## Batasan Produksi (Hard Limit)

* Max file per batch: 20
* Proses hanya di foreground
* Tidak ada resume otomatis
* Tidak ada background processing

---

## Failure Mode & Mitigasi

| Risiko        | Mitigasi               |
| ------------- | ---------------------- |
| Screen mati   | Wake Lock              |
| RAM habis     | Serial + cleanup       |
| App ke-reload | Auto download per file |
| WASM reload   | Service Worker cache   |

---

## PWA Notes

* PWA **harus tetap terbuka** saat proses jalan
* Background processing tidak didukung
* Cocok untuk sesi konversi pendek (album)

---

## Filosofi Build

> Tool ini dibuat untuk **dipakai**, bukan dipamerkan.
> Selama stabil, jujur ke constraint, dan nggak bikin HP KO — itu sudah benar.

---

## Status

Arsitektur final untuk MVP personal.
Siap implementasi.
