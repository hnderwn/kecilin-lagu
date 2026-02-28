import React, { useState, useEffect, useRef } from 'react';
import { conversionQueue } from '../engine/queue';
import { getFileInfo, setEngineStatusListener, initFFmpeg, resetEngine } from '../engine/ffmpegEngine';

const Converter = () => {
  // --- State Aplikasi ---
  const [items, setItems] = useState([]);
  const [accentColor, setAccentColor] = useState('#14b8a6'); // Default: Teal
  const [format, setFormat] = useState('m4a');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showAccentPicker, setShowAccentPicker] = useState(false);
  const [notification, setNotification] = useState(null);
  const [engineStatus, setEngineStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'

  const fileInputRef = useRef(null);

  // --- Konfigurasi Format ---
  const formatOptions = {
    m4a: {
      label: 'AAC (.m4a)',
      bitrates: ['128k', '160k', '192k', '256k', '320k'],
      default: '256k',
    },
    mp3: {
      label: 'MP3',
      bitrates: ['128k', '160k', '192k', '256k'],
      default: '128k',
    },
  };

  const [bitrate, setBitrate] = useState(formatOptions[format].default);

  const accents = [
    { name: 'Gray', color: '#b2b2b2ff' },
    { name: 'Teal', color: '#14b8a6' },
    { name: 'Indigo', color: '#6366f1' },
    { name: 'Rose', color: '#f43f5e' },
    { name: 'Amber', color: '#f59e0b' },
    { name: 'Emerald', color: '#10b981' },
  ];

  // --- Efek & Listener ---
  useEffect(() => {
    // Sinkronisasi state lokal dengan queue engine.
    conversionQueue.onStatusChange = (newQueue) => {
      setItems([...newQueue]);
      const active = newQueue.some((item) => item.status === 'processing');
      setIsProcessing(active);
    };

    // Jalankan inisialisasi awal
    initFFmpeg().catch(() => {});

    // Listener untuk status FFmpeg Engine
    setEngineStatusListener((status) => {
      setEngineStatus(status);
      if (status === 'ready') {
        const hasLoadedBefore = localStorage.getItem('engine_loaded');
        if (hasLoadedBefore) {
          setNotification('Mesin siap! Konversi bisa dilakukan secara offline.');
        } else {
          setNotification('Engine berhasil diunduh. Selamat datang!');
          localStorage.setItem('engine_loaded', 'true');
        }
      }
    });

    return () => setEngineStatusListener(null);
  }, []);

  // Menghilangkan notifikasi setelah beberapa detik.
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // --- Handler Event ---
  const handleFiles = async (files) => {
    if (files.length === 0) return;

    // Cek bitrate untuk file pertama sebagai sampel (atau bisa semua).
    // Untuk efisiensi di WASM, kita cek yang pertama saja untuk memicu notifikasi.
    try {
      const info = await getFileInfo(files[0]);
      if (info.bitrate > 0 && info.bitrate < 256) {
        setNotification(`Perhatian: File "${files[0].name}" sudah memiliki bitrate rendah (${info.bitrate} kbps).`);
      }
    } catch (e) {
      console.warn('Gagal mengecek bitrate:', e);
    }

    conversionQueue.addFiles(files, {
      format: format,
      bitrate: bitrate,
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const startConversion = () => {
    conversionQueue.processNext();
  };

  // --- Sub Komponen ---
  const LoadingOverlay = () => {
    if (engineStatus !== 'loading' && engineStatus !== 'error') return null;

    return (
      <div className="loading-overlay">
        <div className="loading-card">
          {engineStatus === 'loading' ? (
            <>
              <div className="spinner"></div>
              <h2 className="loading-text">Menyiapkan Mesin</h2>
              <p style={{ opacity: 0.7, fontSize: '0.9rem', marginTop: '12px' }}>
                Sedang menyiapkan modul FFmpeg (±30MB).
                <br />
                Hanya dilakukan saat awal atau pembaruan sistem.
              </p>
            </>
          ) : (
            <>
              <div className="engine-error-icon">⚠️</div>
              <h2 style={{ color: '#f43f5e' }}>Gagal Memuat Mesin</h2>
              <p style={{ opacity: 0.7, fontSize: '0.9rem', margin: '12px 0 24px' }}>Koneksi terinterupsi atau browser tidak mendukung WebAssembly.</p>
              <button className="btn btn-primary" onClick={() => resetEngine()}>
                Coba Lagi
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const EngineBadge = () => {
    const statusText = {
      ready: 'Mesin Aktif',
      loading: 'Mengunduh...',
      error: 'Mesin Galat',
      idle: 'Memulai...',
    };

    return (
      <div className="engine-badge" onClick={() => engineStatus === 'error' && resetEngine()}>
        <div className={`dot dot-${engineStatus}`}></div>
        <span>{statusText[engineStatus]}</span>
      </div>
    );
  };

  // --- Variabel Render ---
  const currentItem = items.find((item) => item.status === 'processing');
  const hasFiles = items.length > 0;

  // Jika belum ada file, tampilkan Drop Zone Full Screen.
  if (!hasFiles && !isDragging) {
    return (
      <div className="app-shell landing" style={{ '--accent': accentColor }}>
        <LoadingOverlay />
        <div className="drop-zone-full" onClick={() => fileInputRef.current.click()} onDragOver={onDragOver}>
          <div className="landing-content">
            <h1 className="landing-title">kecilin lagu</h1>
            <p className="landing-sub">Lepaskan audio di sini atau klik untuk memilih</p>
            <div className="supported-formats">FLAC • MP3 • M4A • WAV • OGG • ALAC • AIFF</div>
          </div>
          <input type="file" multiple accept="audio/*" ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell ${isDragging ? 'dragging' : ''}`} onDragOver={onDragOver} onDragLeave={() => setIsDragging(false)} onDrop={onDrop} style={{ '--accent': accentColor }}>
      <LoadingOverlay />
      {/* Notifikasi Ringan */}
      {notification && <div className="toast-notification">{notification}</div>}

      <div className="glass-container">
        {/* HEADER */}
        <header className="app-header">
          <span className="app-name clickable" onClick={() => conversionQueue.clearQueue()}>
            kecilin lagu
          </span>
          <div className="header-actions">
            <EngineBadge />
            <div className="accent-trigger-wrapper">
              <button className="accent-btn" onClick={() => setShowAccentPicker(!showAccentPicker)} title="Ganti Warna Aksen"></button>
              {showAccentPicker && (
                <div className="accent-dropdown">
                  {accents.map((a) => (
                    <div
                      key={a.name}
                      className={`accent-swatch ${accentColor === a.color ? 'active' : ''}`}
                      style={{ backgroundColor: a.color }}
                      onClick={() => {
                        setAccentColor(a.color);
                        setShowAccentPicker(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className={`status-dot ${isProcessing ? 'pulse' : ''}`}></div>
          </div>
        </header>

        {/* CONTROL AREA */}
        <section className="control-area">
          <button className="btn btn-secondary" onClick={() => fileInputRef.current.click()}>
            Tambah File
          </button>
          <button className="btn btn-primary" disabled={isProcessing || !items.some((i) => i.status === 'waiting')} onClick={startConversion}>
            Mulai Kompresi
          </button>
          <input type="file" multiple accept="audio/*" ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} />
        </section>

        {/* STATUS AREA */}
        <section className="status-area">
          <div className="section-title">STATUS</div>
          <div className="status-content">
            <div className="current-track">
              {currentItem ? (
                <>
                  Memproses: {currentItem.file.name}
                  <div className="track-detail-small">
                    {(currentItem.file.size / (1024 * 1024)).toFixed(2)} MB • {currentItem.options.format.toUpperCase()}
                  </div>
                </>
              ) : engineStatus === 'loading' ? (
                <span className="loading-text">Menyiapkan Mesin...</span>
              ) : (
                'Mesin Siap'
              )}
            </div>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${currentItem ? currentItem.progress : 0}%` }}></div>
            </div>
            <div className="time-info">{currentItem ? `${Math.round(currentItem.progress)}%` : '0%'}</div>
          </div>
        </section>

        {/* FILE QUEUE */}
        <section className="queue-area">
          <div className="section-title">ANTREAN FILE</div>
          <div className="queue-list">
            {items.map((item, index) => (
              <div key={item.id} className="queue-item">
                <span className="queue-index">{(index + 1).toString().padStart(2, '0')}</span>
                <span className="queue-name">
                  {item.file.name}
                  <span className="queue-format-tag">{item.options.format.toUpperCase()}</span>
                </span>
                <span className={`queue-status badge-${item.status}`}>
                  {item.status === 'completed' && 'selesai ✓'}
                  {item.status === 'processing' && 'memproses'}
                  {item.status === 'waiting' && 'menunggu'}
                  {item.status === 'error' && 'galat'}
                </span>
                <button className="queue-remove-btn" onClick={() => conversionQueue.removeItem(item.id)} disabled={item.status === 'processing'} title="Hapus dari antrean">
                  &times;
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* OUTPUT SETTINGS & INFO */}
        <section className="output-area">
          <div className="section-title">PENGATURAN & INFO</div>
          <div className="output-grid">
            <div className="output-item">
              <span className="label">Format:</span>
              <select
                value={format}
                onChange={(e) => {
                  const newFormat = e.target.value;
                  const newBitrate = formatOptions[newFormat].default;
                  setFormat(newFormat);
                  setBitrate(newBitrate);
                  conversionQueue.updateAllOptions({
                    format: newFormat,
                    bitrate: newBitrate,
                  });
                }}
                className="inline-select"
              >
                {Object.keys(formatOptions).map((k) => (
                  <option key={k} value={k}>
                    {formatOptions[k].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="output-item">
              <span className="label">Bitrate:</span>
              <select
                value={bitrate}
                onChange={(e) => {
                  const newBitrate = e.target.value;
                  setBitrate(newBitrate);
                  conversionQueue.updateAllOptions({
                    format: format,
                    bitrate: newBitrate,
                  });
                }}
                className="inline-select"
              >
                {formatOptions[format].bitrates.map((b) => (
                  <option key={b} value={b}>
                    {b.replace('k', ' kbps')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Converter;
