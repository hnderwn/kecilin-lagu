# Dokumentasi Teknis — Kecilin Lagu

Dokumen ini menjelaskan arsitektur, logika, dan keputusan teknis di balik pengembangan aplikasi **Kecilin Lagu**. Ditujukan untuk pengembang yang ingin memahami cara kerja sistem atau melakukan pemeliharaan di masa depan.

---

## 1. Engine & Runtime (FFmpeg WASM)

Aplikasi ini menggunakan `@ffmpeg/ffmpeg` versi 0.12.x yang dijalankan di dalam **Web Worker**.

### 1.1 Strategi Self-Hosting

Untuk memastikan keandalan PWA dan kinerja offline, modul FFmpeg tidak dimuat dari CDN publik (`unpkg`).

- **Lokasi**: `/public/ffmpeg-core.js` dan `/public/ffmpeg-core.wasm`.
- **Keuntungan**: Tidak ada latensi jaringan eksternal, kontrol penuh atas versi engine, dan kompatibilitas penuh dengan sistem caching Service Worker.

### 1.2 Manajemen Memori & Engine Recycling

WebAssembly (WASM) memiliki batasan memori yang ketat di browser. Pemrosesan file audio yang besar secara berulang dapat menyebabkan fragmentasi memori.

- **Logika**: Sistem menghitung jumlah file yang selesai diproses (`processedCount`).
- **Recycling**: Setiap **30 file**, engine FFmpeg akan di-`terminate()` secara total dan diinisialisasi ulang. Ini memaksa browser untuk melakukan _Garbage Collection_ dan membebaskan RAM yang tertahan.

---

## 2. Sistem Antrean (Queue System)

Logika inti antrean dikelola dalam kelas `ConversionQueue` di `src/engine/queue.js`.

### 2.1 Pemrosesan Sekuensial

Aplikasi hanya memproses **satu file dalam satu waktu**. Mengingat keterbatasan CPU dan RAM pada perangkat mobile, pemrosesan paralel justru akan menyebabkan sistem melambat atau browser menutup tab karena penggunaan sumber daya yang berlebihan.

### 2.2 Adaptive UI Throttling

Untuk menjaga responsivitas UI saat antrean panjang (misalnya 100+ lagu):

- **Antrean < 25 file**: State UI diperbarui setiap **150ms** (animasi halus).
- **Antrean > 25 file**: State UI diperbarui setiap **500ms**.
- **Tujuan**: Mengurangi beban kerja React (re-rendering) dan memberikan lebih banyak siklus CPU kepada proses encoding FFmpeg.

### 2.3 Stop After Current (Pause Logic)

Implementasi tombol "Jeda Lagu Selanjutnya" menggunakan state `isPaused` pada `ConversionQueue`.

- **Mekanisme**: Saat `isPaused` aktif, fungsi `processNext()` akan berhenti mengambil item baru dari antrean, namun lagu yang sedang dikonversi tidak diinterupsi paksa untuk menghindari korupsi data.

  ***

  ## 3. Logika Smart Adaptive Artwork

  Saat konversi, aplikasi secara dinamis mengubah ukuran sampul album (album art) menggunakan filter `-vf` (Video Filter) di FFmpeg.
  - **Resizing Logic**:
    - `Bitrate <= 128k`: Target 500x500px.
    - `Bitrate 160k - 256k`: Target 600x600px.
    - `Bitrate 320k`: Target 800x800px.
  - **Aspect Ratio**: Menggunakan `force_original_aspect_ratio=decrease` untuk mencegah gambar gepeng, dipadukan dengan filter `pad` untuk memastikan hasil akhir selalu **persegi (1:1)** dengan latar belakang hitam jika gambar aslinya bukan persegi.

  ***

  ## 4. Keandalan & PWA

  ### 4.1 Screen Wake Lock API

  Aplikasi meminta izin `navigator.wakeLock` setiap kali proses konversi dimulai. Ini mencegah sistem operasi (terutama pada Android/iOS) mematikan layar atau menaruh browser ke mode "suspend" yang akan menghentikan proses konversi di tengah antrean.

  ### 4.2 Konfigurasi Vite PWA & Workbox

  Karena file `.wasm` berukuran ~32MB, kami melakukan kustomisasi pada `vite.config.js`:
  - `maximumFileSizeToCacheInBytes`: Dinaikkan menjadi **40MB** (default-nya hanya 2MB).
  - Tanpa pengaturan ini, file engine tidak akan ter-cache, sehingga aplikasi gagal berjalan offline.

  ***

  ## 5. Keamanan & Header Browser

  FFmpeg WASM membutuhkan **SharedArrayBuffer** untuk bekerja (terutama jika nanti menggunakan MT). Ini mengharuskan situs dijalankan dengan header keamanan:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`

  Header ini telah dikonfigurasi di `vite.config.js` untuk server lokal dan harus dipastikan ada pada konfigurasi server produksi (misal: di `vercel.json`).

  ***

  ## 6. Struktur Kode UI

  Aplikasi menggunakan pola **memoization** pada komponen yang berat:
  - **`VinylDisc`**: Menggunakan `React.memo` agar animasi cakram yang berputar tidak ikut tersentak (re-render) setiap kali progres angka % berubah.
  - **Theatrical Mode**: State `isMinimized` digunakan untuk beralih ke tampilan fokus yang hanya menampilkan vinyl dan progres untuk kenyamanan saat memproses ratusan lagu.

---

## 7. Metadata & Naming Logic

### 7.1 Auto-Metadata Extraction

Aplikasi mengotomatiskan pengisian metadata (Title, Artist, Album) dengan menjalankan perintah `ffmpeg -i filename` sebelum konversi dimulai.

- **Regex Parsing**: Log keluaran FFmpeg diurai menggunakan regular expression untuk menangkap tag metadata asli. Ini diimplementasikan di `getFileInfo` dalam `ffmpegEngine.js`.

### 7.2 Naming Templating System

Memungkinkan pengguna mengatur nama file keluaran menggunakan placeholders.

- **Replacement Logic**: Digunakan pola `String.replace()` untuk menukar tag:
  - `[NAME]` -> Nama asli file (tanpa ekstensi).
  - `[BITRATE]` -> Angka bitrate target (misal: 128k).
  - `[EXT]` -> Ekstensi target (misal: mp3).
- **Sanitization**: Setiap template dibersihkan dari karakter ilegal sistem operasi menggunakan regex pelindung: `/[\\/:*?"<>|]/g`.

---

_Dokumentasi ini diperbarui terakhir pada: Maret 2026_
