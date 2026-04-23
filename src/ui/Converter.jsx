import React, { useState, useEffect, useRef, memo } from 'react';
import { conversionQueue } from '../engine/queue';
import { getFileInfo, setEngineStatusListener, initFFmpeg, resetEngine } from '../engine/ffmpegEngine';
import { subscribeToLogs, clearLogs } from '../utils/logger';

/* ── VinylDisc memo — isolated from progress re-renders ── */
const VinylDisc = memo(({ isSpinning, accentColor }) => (
  <div className={`vinyl-disc ${isSpinning ? 'spinning' : 'slowing'}`} style={{ '--accent': accentColor }}>
    <div className="vinyl-label" />
  </div>
));

const MetadataEditor = ({ editingItem, setEditingItem, isMinimized }) => {
  if (!editingItem) return null;

  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [meta, setMeta] = useState({
    title: editingItem.options.metadata?.title || '',
    artist: editingItem.options.metadata?.artist || '',
    album: editingItem.options.metadata?.album || '',
    genre: editingItem.options.metadata?.genre || '',
    year: editingItem.options.metadata?.year || '',
    track: editingItem.options.metadata?.track || '',
  });
  const [coverFile, setCoverFile] = useState(editingItem.options.coverFile || null);
  const [applyToAll, setApplyToAll] = useState(false);
  const [detectedLyrics, setDetectedLyrics] = useState(false);
  const [keepLyrics, setKeepLyrics] = useState(editingItem.options.keepLyrics !== false);

  const coverInputRef = useRef(null);

  // Auto-fetch metadata saat modal pertama kali dibuka
  useEffect(() => {
    // Cek apakah item ini sudah pernah di-fetch metadatanya (ada field apa pun yang tidak undefined)
    const hasInitialMeta = editingItem.options.metadata && Object.keys(editingItem.options.metadata).length > 0;

    if (!hasInitialMeta) {
      let isMounted = true;
      const fetchMeta = async () => {
        setIsLoadingMeta(true);
        try {
          const info = await getFileInfo(editingItem.file);
          if (isMounted) {
            setMeta({
              ...meta,
              title: info.title || meta.title || editingItem.file.name.replace(/\.[^/.]+$/, ''),
              artist: info.artist || '',
              album: info.album || '',
              genre: info.genre || '',
              year: info.year || '',
              track: info.track || '',
            });
            setDetectedLyrics(info.hasLyrics);
          }
        } catch (e) {
          console.warn('Gagal memuat metadata asli:', e);
        } finally {
          if (isMounted) setIsLoadingMeta(false);
        }
      };
      fetchMeta();
      return () => {
        isMounted = false;
      };
    }
  }, [editingItem]); // meta dihapus dari dependencies agar aman dari loop

  const handleSave = () => {
    const updatedOptions = { metadata: meta, coverFile, keepLyrics };
    if (applyToAll) {
      conversionQueue.applyBatchMetadata(meta, coverFile);
    }
    conversionQueue.updateItemOptions(editingItem.id, updatedOptions);
    setEditingItem(null);
  };

  const handleCoverChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setCoverFile(e.target.files[0]);
    }
  };

  return (
    <div className={`meta-editor-overlay ${isMinimized ? 'is-minimized' : ''}`} onClick={() => setEditingItem(null)}>
      <div className="meta-editor-card" onClick={(e) => e.stopPropagation()}>
        <div className="meta-editor-header">
          <span>Edit Metadata {isLoadingMeta && <span className="loading-text-small">(Membaca...)</span>}</span>
          <button className="meta-close" onClick={() => setEditingItem(null)}>
            ×
          </button>
        </div>
        <div className="meta-editor-body" style={{ opacity: isLoadingMeta ? 0.6 : 1, transition: 'opacity 0.3s' }}>
          <div className="meta-field">
            <label>Title</label>
            <input type="text" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="Judul lagu..." disabled={isLoadingMeta} autoFocus />
          </div>
          <div className="meta-row">
            <div className="meta-field">
              <label>Artist</label>
              <input type="text" value={meta.artist} onChange={(e) => setMeta({ ...meta, artist: e.target.value })} placeholder="Penyanyi" disabled={isLoadingMeta} />
            </div>
            <div className="meta-field">
              <label>Album</label>
              <input type="text" value={meta.album} onChange={(e) => setMeta({ ...meta, album: e.target.value })} placeholder="Album" disabled={isLoadingMeta} />
            </div>
          </div>
          <div className="meta-row">
            <div className="meta-field">
              <label>Genre</label>
              <input type="text" value={meta.genre} onChange={(e) => setMeta({ ...meta, genre: e.target.value })} placeholder="Pop, Rock" disabled={isLoadingMeta} />
            </div>
            <div className="meta-field">
              <label>Year</label>
              <input type="text" value={meta.year} onChange={(e) => setMeta({ ...meta, year: e.target.value })} placeholder="YYYY" disabled={isLoadingMeta} />
            </div>
            <div className="meta-field">
              <label>Track No.</label>
              <input type="text" value={meta.track} onChange={(e) => setMeta({ ...meta, track: e.target.value })} placeholder="1/10" disabled={isLoadingMeta} />
            </div>
          </div>

          <div className="meta-field cover-field">
            <label>Custom Cover (JPG/PNG)</label>
            <div className="cover-upload-area" onClick={() => coverInputRef.current?.click()}>
              {coverFile ? <span className="cover-name">{coverFile.name}</span> : <span className="cover-placeholder">Klik untuk unggah gambar</span>}
            </div>
            <input type="file" ref={coverInputRef} onChange={handleCoverChange} accept="image/png, image/jpeg" style={{ display: 'none' }} disabled={isLoadingMeta}/>
            {coverFile && <button className="cover-clear-btn" onClick={() => setCoverFile(null)}>Hapus</button>}
          </div>

          {detectedLyrics && (
            <div className="meta-lyrics-notice">
              <span className="lyrics-icon">♪</span> Lagu ini memiliki lirik bawaan
              <label className="lyrics-toggle">
                <input type="checkbox" checked={keepLyrics} onChange={(e) => setKeepLyrics(e.target.checked)} />
                Pertahankan Lirik
              </label>
            </div>
          )}
        </div>
        <div className="meta-editor-footer">
          <label className="batch-apply-toggle">
            <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} />
            Terapkan Artist, Album, Genre, & Cover ke semua sisa antrean
          </label>
          <button className="btn btn-primary" onClick={handleSave} disabled={isLoadingMeta}>
            {isLoadingMeta ? 'Mohon Tunggu...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Converter = () => {
  // --- State Aplikasi ---
  const [items, setItems] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [namingTemplate, setNamingTemplate] = useState('[NAME]_kecil');
  const [isNamingActive, setIsNamingActive] = useState(false);
  const [accentColor, setAccentColor] = useState('#14b8a6');
  const [format, setFormat] = useState('m4a');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showAccentPicker, setShowAccentPicker] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showNaming, setShowNaming] = useState(false);
  const [notification, setNotification] = useState(null);
  const [engineStatus, setEngineStatus] = useState('idle');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [stripMetadata, setStripMetadata] = useState(false);
  const [coverMode, setCoverMode] = useState('resample');
  const [logs, setLogs] = useState([]);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // --- Konfigurasi Format ---
  const formatOptions = {
    m4a: {
      label: 'AAC (.m4a)',
      bitrates: ['128k', '160k', '192k', '256k', '320k'],
      default: '160k',
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
    conversionQueue.onStatusChange = (newQueue, state) => {
      setItems([...newQueue]);
      setIsPaused(state.isPaused);
      setNamingTemplate(state.namingTemplate);
      setIsNamingActive(state.isNamingActive);
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

    const unsubscribe = subscribeToLogs((newLogs) => {
      setLogs([...newLogs]);
    });

    return () => {
      setEngineStatusListener(null);
      unsubscribe();
    };
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
    
    // Filter out non-audio files (useful for folder drops)
    const audioFiles = Array.from(files).filter(file => 
      file.type.startsWith('audio/') || file.name.match(/\.(mp3|m4a|flac|wav|ogg|alac|aiff)$/i)
    );

    if (audioFiles.length === 0) {
      setNotification('Tidak ada file audio yang didukung ditemukan.');
      return;
    }

    if (audioFiles.length > 5) {
      setNotification(`Menambahkan ${audioFiles.length} file. Mohon "Allow" / "Izinkan" jika browser meminta izin Multiple Downloads nanti.`);
    }

    try {
      const info = await getFileInfo(audioFiles[0]);
      if (info.bitrate > 0 && info.bitrate < 256) {
        setNotification(`Perhatian: "${audioFiles[0].name}" sudah berbitrate rendah (${info.bitrate} kbps).`);
      }
    } catch (e) {
      console.warn('Gagal mengecek bitrate:', e);
    }
    conversionQueue.addFiles(audioFiles, { format, bitrate, stripMetadata, coverMode });
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.items) {
      const collectedFiles = [];
      
      // Fungsi penjelajah item (file/folder)
      const scanFiles = async (entry) => {
        if (!entry) return;
        if (entry.isDirectory) {
          const dirReader = entry.createReader();
          // Baca isi folder (bisa dipecah jika itemnya sangat banyak, tp untuk standar cukup)
          const entries = await new Promise((resolve) => {
            dirReader.readEntries(resolve);
          });
          for (let i = 0; i < entries.length; i++) {
            await scanFiles(entries[i]);
          }
        } else if (entry.isFile) {
          const file = await new Promise((resolve) => entry.file(resolve));
          collectedFiles.push(file);
        }
      };

      const scanPromises = [];
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const entry = e.dataTransfer.items[i].webkitGetAsEntry();
        if (entry) {
          scanPromises.push(scanFiles(entry));
        }
      }

      await Promise.all(scanPromises);
      if (collectedFiles.length > 0) {
        handleFiles(collectedFiles);
      }
    } else {
      // Fallback untuk browser lawas
      handleFiles(e.dataTransfer.files);
    }
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
  const ConsoleTerminal = () => {
    const scrollRef = useRef(null);

    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [logs, showConsole]);

    if (!showConsole) return null;

    return (
      <div className="console-overlay" onClick={() => setShowConsole(false)}>
        <div className="console-window" onClick={(e) => e.stopPropagation()}>
          <div className="console-header">
            <div className="console-title">
              <span className="prompt">$</span> system.logs
            </div>
            <div className="console-actions">
              <button className="console-btn-text" onClick={clearLogs}>Clear</button>
              <button className="console-btn-text" onClick={() => setShowConsole(false)}>Close</button>
            </div>
          </div>
          <div className="console-body" ref={scrollRef}>
            {logs.length === 0 ? (
              <div className="console-empty">No logs captured yet...</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className={`log-entry log-${log.type}`}>
                  <span className="log-time">[{log.timestamp}]</span>
                  <span className="log-msg">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

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
                Atau pilih manual:
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px', marginBottom: '8px', zIndex: 10, position: 'relative' }}>
                <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }}>Pilih File</button>
                <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); folderInputRef.current.click(); }}>Pilih Folder</button>
              </div>
              <p className="supported-formats">
                FLAC · MP3 · M4A · WAV
                <br />
                OGG · ALAC · AIFF
              </p>
            </div>
          </div>

          <input type="file" multiple accept="audio/*" ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} />
          <input type="file" webkitdirectory="" directory="" multiple ref={folderInputRef} onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} />
        </div>
        <ConsoleTerminal />
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

                {/* Mini Pause Toggle in Theatrical */}
                {isProcessing && (
                  <button className={`vinyl-pause-btn ${isPaused ? 'is-paused' : ''}`} onClick={() => conversionQueue.togglePause()} title={isPaused ? 'Lanjutkan' : 'Jeda setelah file ini'}>
                    {isPaused ? '▶' : 'Ⅱ'}
                  </button>
                )}
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
        <MetadataEditor editingItem={editingItem} setEditingItem={setEditingItem} isMinimized={isMinimized} />
        <ConsoleTerminal />
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
            <button className={`console-trigger ${showConsole ? 'active' : ''}`} onClick={() => setShowConsole(!showConsole)} title="Toggle System Console">
              LOG
            </button>
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
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => fileInputRef.current.click()}>
                + Tambah File
              </button>
              <button className="btn btn-secondary" onClick={() => folderInputRef.current.click()}>
                + Tambah Folder
              </button>
            </div>

            {!isProcessing && !isPaused ? (
              <button className="btn btn-primary" disabled={!items.some((i) => i.status === 'waiting')} onClick={startConversion}>
                ▶ Mulai Kompresi
              </button>
            ) : (
              <button className={`btn ${isPaused ? 'btn-primary' : 'btn-danger'}`} onClick={() => conversionQueue.togglePause()} style={{ minWidth: '160px' }}>
                {isPaused ? '▶ Lanjutkan' : 'Ⅱ Jeda Lagu Selanjutnya'}
              </button>
            )}

            <input type="file" multiple accept="audio/*" ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} />
            <input type="file" webkitdirectory="" directory="" multiple ref={folderInputRef} onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} />
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

                  {item.status === 'waiting' && (
                    <button className="queue-edit-btn" onClick={() => setEditingItem(item)} title="Edit Metadata">
                      Edit Meta <span style={{ fontSize: '0.6em', opacity: 0.7, textTransform: 'uppercase' }}>(Beta)</span>
                    </button>
                  )}

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
                    conversionQueue.updateAllOptions({ format: newFormat, bitrate: newBitrate, stripMetadata, coverMode });
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
                    conversionQueue.updateAllOptions({ format, bitrate: newBitrate, stripMetadata, coverMode });
                  }}
                >
                  {formatOptions[format].bitrates.map((b) => (
                    <option key={b} value={b}>
                      {b.replace('k', ' kbps')}
                    </option>
                  ))}
                </select>
                <div className="output-row" style={{ marginTop: '12px' }}>
                  <span className="label">Privasi: Strip Meta</span>
                  <button
                    className={`terminal-switch ${stripMetadata ? 'is-active' : ''}`}
                    onClick={() => {
                      const newState = !stripMetadata;
                      setStripMetadata(newState);
                      conversionQueue.updateAllOptions({ format, bitrate, stripMetadata: newState, coverMode });
                    }}
                    title="Hapus semua metadata dan artwork demi privasi"
                  >
                    {stripMetadata ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div className="output-row" style={{ marginTop: '12px' }}>
                  <span className="label">Album Cover</span>
                  <select 
                    className="inline-select" 
                    value={coverMode} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setCoverMode(val);
                      conversionQueue.updateAllOptions({ format, bitrate, stripMetadata, coverMode: val });
                    }}
                    style={{ width: '110px' }}
                    title="Convert: Kompres otomatis (Aman)&#10;Asli: Biarkan bawaan (Bisa gagal)&#10;No Cover: Hapus cover"
                  >
                    <option value="resample">Convert</option>
                    <option value="copy">Asli</option>
                    <option value="skip">No Cover</option>
                  </select>
                </div>
              </div>
              <div className="output-item-wide">
                <div className="output-row">
                  <span className="label">Naming Template</span>
                  <button
                    className={`terminal-switch ${isNamingActive ? 'is-active' : ''}`}
                    onClick={() => {
                      const newState = !isNamingActive;
                      setIsNamingActive(newState);
                      conversionQueue.setNamingActive(newState);
                    }}
                  >
                    {isNamingActive ? 'ON' : 'OFF'}
                  </button>
                </div>

                {isNamingActive && (
                  <div className="template-accordion-content">
                    <div className="template-input-wrapper">
                      <span className="template-prefix">&gt;</span>
                      <input
                        type="text"
                        className="template-input"
                        value={namingTemplate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNamingTemplate(val);
                          conversionQueue.setNamingTemplate(val);
                        }}
                        placeholder="Contoh: [NAME]_kecil"
                      />
                    </div>
                    <p className="template-hint">
                      Tags: <strong>[NAME]</strong>, <strong>[BITRATE]</strong>, <strong>[EXT]</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
      <MetadataEditor editingItem={editingItem} setEditingItem={setEditingItem} isMinimized={isMinimized} />
      <ConsoleTerminal />
    </div>
  );
};

export default Converter;
