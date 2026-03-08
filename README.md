# Kecilin Lagu — Audio Converter PWA

**Kecilin Lagu** adalah aplikasi web modern (PWA) untuk mengompresi dan mengonversi file audio secara massal langsung di dalam browser. Aplikasi ini dirancang dengan estetika **Brutalist × Terminal** yang raw dan fungsional, memberikan pengalaman konversi yang cepat, aman, dan privat.

---

## ⚡ Fitur Utama

- **100% Client-Side**: Proses konversi terjadi sepenuhnya di perangkat Anda menggunakan **FFmpeg WASM**. File Anda tidak pernah diunggah ke server.
- **Dukungan Format Luas**: Mendukung input dari berbagai format audio (FLAC, WAV, MP3, M4A, OGG) bahkan ekstraksi audio dari video.
- **Auto-Metadata Detection**: Secara otomatis membaca Judul, Artis, dan Album dari file asli saat Anda ingin mengedit metadata, memudahkan perbaikan tag massal.
- **Naming Template**: Atur pola nama file output secara dinamis menggunakan tag seperti `[NAME]`, `[BITRATE]`, dan `[EXT]`.
- **Stop After Current (Jeda)**: Fitur "Jeda Sistem" yang cerdas; aplikasi akan menyelesaikan lagu yang sedang diproses sebelum benar-benar berhenti, menjaga file tetap utuh.
- **Smart Adaptive Artwork**: Secara otomatis menyesuaikan ukuran album art berdasarkan bitrate yang dipilih (500px - 800px) untuk menjaga kualitas visual tetap proporsional.
- **Batch Processing**: Masukkan ratusan file sekaligus ke dalam antrean (Tracklist) dan biarkan aplikasi menyelesaikannya satu per satu.
- **Dukungan PWA & Offline**: Install aplikasi ke desktop atau HP. Berkat self-hosted WASM, aplikasi tetap bisa bekerja tanpa koneksi internet setelah muatan pertama.
- **Theatrical Pane**: Mode visualisasi cakram vinyl yang berputar saat proses konversi berlangsung, memberikan pengalaman auditif-visual yang unik.
- **Engine Recycling**: Sistem otomatis mendaur ulang engine FFmpeg setiap 30 file untuk memastikan penggunaan RAM tetap stabil dan mencegah crash pada antrean panjang.

---

## 🛠️ Arsitektur & Sistem

### 1. FFmpeg WASM (Engine)

Aplikasi ini menggunakan modul FFmpeg yang dikompilasi ke WebAssembly. Kami menggunakan teknik **Self-Hosting** di folder `public/` untuk memastikan stabilitas dan kecepatan akses, menghindari ketergantungan pada CDN luar.

### 2. Service Worker & Caching (PWA)

Menggunakan **Vite PWA Plugin** dengan konfigurasi **Workbox** yang ditingkatkan. Limit cache dinaikkan hingga **40MB** untuk menampung file `.wasm` yang besar, memungkinkan aplikasi berjalan 100% offline.

### 3. Screen Wake Lock API

Saat melakukan konversi massal yang memakan waktu lama, aplikasi menggunakan **Wake Lock API** untuk mencegah perangkat masuk ke mode tidur (sleep), memastikan proses konversi tidak terputus di tengah jalan.

### 4. Throttling UI Adaptif

Sistem antrean memiliki logika throttling yang cerdas:

- **Antrean < 25 file**: Update progres setiap 150ms (visual sangat halus).
- **Antrean > 25 file**: Update progres setiap 500ms (menghemat daya CPU untuk prioritas konversi).

---

## 🚀 Alur Kerja Aplikasi

1.  **Drop & Select**: Pengguna menyeret file ke area Brutalist Landing.
2.  **Konfigurasi**: Memilih format target (MP3/M4A) dan bitrate melalui pengaturan terminal.
3.  **Antrean (Tracklist)**: File masuk ke daftar tunggu dengan ID unik.
4.  **Konversi Massal**: Engine memproses file satu per satu, mengompresinya, menyesuaikan album art, dan memicu unduhan otomatis sesaat setelah selesai.
5.  **Clean-up**: Setelah file diproses, memori virtual FFmpeg dibersihkan segera untuk menjaga performa.

---

## 💻 Cara Menjalankan Secara Lokal

1. Clone repositori:
   ```bash
   git clone https://github.com/hnderwn/kecilin-lagu.git
   ```
2. Install dependensi:
   ```bash
   npm install
   ```
3. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```

---

_Dibuat dengan ❤️ untuk privasi dan efisiensi audio._
