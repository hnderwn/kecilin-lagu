tolong buatkan image preview web app dengan wireframe ini:

┌──────────────────────────────────────────────┐

│ kecilin lagu                         ●(color accent)  │

│──────────────────────────────────────────────│

│                                              │

│  [ Select Files ]        [ Start Convert ]   │

│                                              │

│──────────────────────────────────────────────│

│ STATUS                                       │

│  Encoding track02.flac                        │

│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░           │

│  02:31 / 04:58                                │

│──────────────────────────────────────────────│

│ FILE QUEUE                                   │

│  ──────────────────────────────────────────  │

│  01  track01.flac        [ done ✓ ]           │

│  02  track02.flac        [ converting ]       │

│  03  track03.flac        [ waiting ]          │

│                                              │

│──────────────────────────────────────────────│

│ OUTPUT                                       │

│  Format: AAC (.m4a)                           │

│  Bitrate: 256 kbps                            │

│  Processing: Serial (1 by 1)                  │

│  Wake Lock: ON                                │

│  Accent: ● teal ▾                             │

└──────────────────────────────────────────────┘


🔝 HEADER (PENTING)


kecilin lagu                             ●

Kiri: nama app kecil, lowercase

Kanan: ikon bulat warna accent

idle → accent normal

converting → pulse halus (CSS aja)

done → solid

error → merah

👉 ini gantiin text “idle”, lebih clean & modern.

🔘 CONTROL AREA (LANGSUNG KERJA)


[ Select Files ]    [ Start Convert ]

Tombol gede dikit

Disabled state jelas

Start Convert nggak nyala kalau file kosong

No dropdown dulu → MVP fokus.

📊 STATUS (LANGSUNG KELIHATAN)

Selalu kelihatan walau queue panjang

Satu progress bar aja (file aktif)

Text jujur, nggak animasi lebay

📂 FILE QUEUE

Urutan album kerasa

Scrollable kalau panjang

Status badge kecil

Ini area utama user ngeliat kerja app

🎚️ OUTPUT (PALING BAWAH)

Jarang diutak-atik

Setting statis

Accent picker taro sini biar nggak ganggu

🎨 ACCENT SYSTEM (TETEP AMAN)

Icon bulat header = warna accent

Progress bar = accent

Status “converting / done” = accent

Error = merah (fix, bukan accent)

🧠 KENAPA URUTAN INI MASUK AKAL?

Nama & status global

Aksi utama

Feedback real-time

Detail proses

Konfigurasi

Flow-nya:


klik → lihat → tunggu → selesai


