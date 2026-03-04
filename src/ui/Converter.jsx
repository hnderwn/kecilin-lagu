import React, { useState, useEffect, useRef, memo } from 'react';
import { conversionQueue } from '../engine/queue';
import { getFileInfo, setEngineStatusListener, initFFmpeg, resetEngine } from '../engine/ffmpegEngine';

/* ── VinylDisc memo — isolated from progress re-renders ── */
const VinylDisc = memo(({ isSpinning, accentColor }) => (
  <div className={`vinyl-disc ${isSpinning ? 'spinning' : 'slowing'}`} style={{ '--accent': accentColor }}>
    <div className="vinyl-label" />
  </div>
));

const Converter = () => {
  // --- State Aplikasi ---
  const [items, setItems] = useState([]);
  const [accentColor, setAccentColor] = useState('#14b8a6');
  const [format, setFormat] = useState('m4a');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showAccentPicker, setShowAccentPicker] = useState(false);
  const [notification, setNotification] = useState(null);
  const [engineStatus, setEngineStatus] = useState('idle');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    { name: 'Gray', color: '#b2b2b2' },
    { name: 'Teal', color: '#14b8a6' },
    { name: 'Indigo', color: '#6366f1' },
    { name: 'Rose', color: '#f43f5e' },
    { name: 'Amber', color: '#f59e0b' },
    { name: 'Emerald', color: '#10b981' },
  ];

  // --- Efek & Listener ---
  useEffect(() => {
    conversionQueue.onStatusChange = (newQueue) => {
      setItems([...newQueue]);
      const active = newQueue.some((item) => item.status === 'processing');
      setIsProcessing(active);
    };

    initFFmpeg().catch(() => {});

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

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // --- Handler Event ---
  const handleFiles = async (files) => {
    if (files.length === 0) return;
    try {
      const info = await getFileInfo(files[0]);
      if (info.bitrate > 0 && info.bitrate < 256) {
        setNotification(`Perhatian: "${files[0].name}" sudah berbitrate rendah (${info.bitrate} kbps).`);
      }
    } catch (e) {
      console.warn('Gagal mengecek bitrate:', e);
    }
    conversionQueue.addFiles(files, { format, bitrate });
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

  const startConversion = () => conversionQueue.processNext();

  // --- Window Control Handlers ---
  const handleClose = () => conversionQueue.clearQueue();
  const handleMinimize = () => setIsMinimized(true);
  const handleMaximize = () => setIsFullscreen((prev) => !prev);
  const handleExpand = () => setIsMinimized(false);

  // --- Sub Komponen ---
  const LoadingOverlay = () => {
    if (engineStatus !== 'loading' && engineStatus !== 'error') return null;
    return (
      <div className="loading-overlay">
        <div className="loading-card">
          {engineStatus === 'loading' ? (
            <>
              <div className="spinner" />
              <p className="loading-text">Menyiapkan Mesin</p>
              <p style={{ opacity: 0.5, fontSize: '0.72rem', marginTop: '14px', lineHeight: 1.7 }}>
                Mengunduh modul FFmpeg (±30MB).
                <br />
                Hanya dilakukan saat awal atau pembaruan.
              </p>
            </>
          ) : (
            <>
              <div className="engine-error-icon">⚠</div>
              <p style={{ fontWeight: 700, fontSize: '0.72rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#f43f5e', marginBottom: '10px' }}>Gagal Memuat Mesin</p>
              <p style={{ opacity: 0.5, fontSize: '0.72rem', marginBottom: '24px', lineHeight: 1.7 }}>Koneksi terinterupsi atau browser tidak mendukung WebAssembly.</p>
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
        <div className={`dot dot-${engineStatus}`} />
        <span>{statusText[engineStatus]}</span>
      </div>
    );
  };

  // --- Variabel Render ---
  const currentItem = items.find((item) => item.status === 'processing');
  const hasFiles = items.length > 0;
  const doneCount = items.filter((i) => i.status === 'completed').length;
  const progress = currentItem ? currentItem.progress : 0;

  // Helper — status label
  const statusLabel = (status) => {
    if (status === 'completed') return 'Selesai';
    if (status === 'processing') return 'Proses';
    if (status === 'error') return 'Galat';
    return '···';
  };

  // ==================== LANDING ====================
  if (!hasFiles && !isDragging) {
    return (
      <div className="app-shell theatrical landing" style={{ '--accent': accentColor }}>
        <LoadingOverlay />
        <div className="drop-zone-full" onClick={() => fileInputRef.current.click()} onDragOver={onDragOver}>
          <div className="drop-border" />
          <div className="drop-corner tl" />
          <div className="drop-corner tr" />
          <div className="drop-corner bl" />
          <div className="drop-corner br" />

          <div className="drop-hint">
            <span className="drop-hint-icon">↓</span>
            <span className="drop-hint-text">Lepaskan file di sini</span>
          </div>

          <div className="landing-content">
            <p className="landing-eyebrow">Audio Converter — PWA</p>
            <h1 className="landing-title">
              KECILIN
              <span className="line-2">LAGU</span>
            </h1>
            <div className="landing-bottom">
              <p className="landing-sub">
                Lepaskan file audio di sini
                <br />
                atau klik untuk memilih
              </p>
              <p className="supported-formats">
                FLAC · MP3 · M4A · WAV
                <br />
                OGG · ALAC · AIFF
              </p>
            </div>
          </div>

          <input type="file" multiple accept="audio/*" ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} />
        </div>
      </div>
    );
  }

  // ==================== THEATRICAL PANE ====================
  if (isMinimized) {
    return (
      <div className="app-shell" style={{ '--accent': accentColor }} onDragOver={onDragOver} onDragLeave={() => setIsDragging(false)} onDrop={onDrop}>
        <LoadingOverlay />
        {notification && <div className="toast-notification">{notification}</div>}

        <div className="theatrical-pane">
          {/* Expand button */}
          <button className="theatrical-expand" onClick={handleExpand} title="Kembali ke editor">
            ⤢
          </button>

          <div className="theatrical-columns">
            {/* ── LEFT: Vinyl + Info ── */}
            <div className="theatrical-left">
              {/* VinylDisc memo — tidak re-render saat progress update */}
              <VinylDisc isSpinning={isProcessing} accentColor={accentColor} />

              <div className="vinyl-info">
                <div className={`vinyl-filename ${!currentItem ? 'vinyl-idle' : ''}`}>{currentItem ? currentItem.file.name : '— Tidak ada file diproses'}</div>
                {currentItem && (
                  <div className="vinyl-meta">
                    {(currentItem.file.size / (1024 * 1024)).toFixed(1)} MB &nbsp;·&nbsp;
                    {currentItem.options.format.toUpperCase()}
                    &nbsp;·&nbsp;
                    {currentItem.options.bitrate.replace('k', ' kbps')}
                  </div>
                )}
                <div className="vinyl-progress-container">
                  <div className="vinyl-progress-bar" style={{ width: `${progress}%` }} />
                </div>
                <div className="vinyl-percent">{Math.round(progress)}%</div>
              </div>
            </div>

            {/* ── RIGHT: Track list (view only) ── */}
            <div className="theatrical-right">
              <div className="theatrical-right-header">
                Tracklist
                <span className="track-count">
                  {items.length} file · {doneCount} selesai
                </span>
              </div>
              <div className="theatrical-track-list">
                {items.map((item, index) => (
                  <div key={item.id} className={`theatrical-track-item ${item.status === 'processing' ? 'is-active' : ''}`}>
                    <span className="theatrical-track-index">{(index + 1).toString().padStart(2, '0')}</span>
                    <span className="theatrical-track-name">{item.file.name}</span>
                    <span className={`theatrical-track-status badge-${item.status}`}>{statusLabel(item.status)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== INNER APP ====================
  return (
    <div className={`app-shell ${isDragging ? 'dragging' : ''}`} onDragOver={onDragOver} onDragLeave={() => setIsDragging(false)} onDrop={onDrop} style={{ '--accent': accentColor }}>
      <LoadingOverlay />
      {notification && <div className="toast-notification">{notification}</div>}

      <div className={`converter-window ${isFullscreen ? 'is-fullscreen' : ''}`}>
        {/* TITLEBAR */}
        <header className="app-header">
          <div className="window-controls">
            <button className="wc-btn wc-close" title="Tutup / Hapus semua" onClick={handleClose}>
              ×
            </button>
            <button className="wc-btn wc-minimize" title="Theatrical Pane" onClick={handleMinimize}>
              −
            </button>
            <button className="wc-btn wc-maximize" title={isFullscreen ? 'Kembalikan ukuran' : 'Perbesar'} onClick={handleMaximize}>
              {isFullscreen ? '↙' : '↗'}
            </button>
          </div>

          <span className="window-title">kecilin lagu</span>

          <div className="header-actions">
            <EngineBadge />
            <div className="accent-trigger-wrapper">
              <button className="accent-btn" onClick={() => setShowAccentPicker(!showAccentPicker)} title="Ganti Warna Aksen" />
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
          </div>
        </header>

        <div className="app-body">
          {/* CONTROLS */}
          <section className="control-area">
            <button className="btn btn-secondary" onClick={() => fileInputRef.current.click()}>
              + Tambah File
            </button>
            <button className="btn btn-primary" disabled={isProcessing || !items.some((i) => i.status === 'waiting')} onClick={startConversion}>
              ▶ Mulai Kompresi
            </button>
            <input type="file" multiple accept="audio/*" ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} />
          </section>

          {/* STATUS */}
          <section className="status-area">
            <div className="section-title">Now Processing</div>
            <div className="current-track">{currentItem ? currentItem.file.name : engineStatus === 'loading' ? <span className="loading-text">Menyiapkan Mesin...</span> : '— Mesin Siap'}</div>
            {currentItem && (
              <div className="track-detail-small">
                {(currentItem.file.size / (1024 * 1024)).toFixed(2)} MB &nbsp;·&nbsp;
                {currentItem.options.format.toUpperCase()}
              </div>
            )}
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="time-info">{Math.round(progress)}%</div>
          </section>

          {/* TRACKLIST */}
          <section className="queue-area">
            <div className="section-title">
              Tracklist
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.6rem',
                  color: 'var(--text-dim)',
                  letterSpacing: '1px',
                  fontWeight: 600,
                }}
              >
                {items.length} file · {doneCount} selesai
              </span>
            </div>
            <div className="queue-list">
              {items.map((item, index) => (
                <div key={item.id} className="queue-item">
                  <span className="queue-index">{(index + 1).toString().padStart(2, '0')}</span>
                  <span className="queue-name">
                    {item.file.name}
                    <span className="queue-format-tag">{item.options.format.toUpperCase()}</span>
                  </span>
                  <span className={`queue-status badge-${item.status}`}>{statusLabel(item.status)}</span>
                  <button className="queue-remove-btn" onClick={() => conversionQueue.removeItem(item.id)} disabled={item.status === 'processing'} title="Hapus dari antrean">
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* OUTPUT SETTINGS */}
          <section className="output-area">
            <div className="section-title">Output</div>
            <div className="output-grid">
              <div className="output-item">
                <span className="label">Format</span>
                <select
                  value={format}
                  className="inline-select"
                  onChange={(e) => {
                    const newFormat = e.target.value;
                    const newBitrate = formatOptions[newFormat].default;
                    setFormat(newFormat);
                    setBitrate(newBitrate);
                    conversionQueue.updateAllOptions({ format: newFormat, bitrate: newBitrate });
                  }}
                >
                  {Object.keys(formatOptions).map((k) => (
                    <option key={k} value={k}>
                      {formatOptions[k].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="output-item">
                <span className="label">Bitrate</span>
                <select
                  value={bitrate}
                  className="inline-select"
                  onChange={(e) => {
                    const newBitrate = e.target.value;
                    setBitrate(newBitrate);
                    conversionQueue.updateAllOptions({ format, bitrate: newBitrate });
                  }}
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
    </div>
  );
};

export default Converter;
