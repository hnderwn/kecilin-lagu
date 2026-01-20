import React, { useState, useEffect, useRef } from 'react';
import { conversionQueue } from '../engine/queue';
import { getFileInfo } from '../engine/ffmpegEngine';

const Converter = () => {
  // --- State Aplikasi ---
  const [items, setItems] = useState([]);
  const [accentColor, setAccentColor] = useState('#14b8a6'); // Default: Teal
  const [format, setFormat] = useState('m4a');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showAccentPicker, setShowAccentPicker] = useState(false);
  const [notification, setNotification] = useState(null);

  const fileInputRef = useRef(null);

  // --- Konfigurasi Format ---
  const formatOptions = {
    m4a: { label: 'AAC (.m4a)', bitrate: '256 kbps', value: '256k' },
    mp3: { label: 'MP3', bitrate: '128 kbps', value: '128k' },
    opus: { label: 'OPUS', bitrate: '128 kbps', value: '128k' },
  };

  const accents = [
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
      bitrate: formatOptions[format].value,
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

  // --- Variabel Render ---
  const currentItem = items.find((item) => item.status === 'processing');
  const hasFiles = items.length > 0;

  // Jika belum ada file, tampilkan Drop Zone Full Screen.
  if (!hasFiles && !isDragging) {
    return (
      <div className="app-shell landing" style={{ '--accent': accentColor }}>
        <div className="drop-zone-full" onClick={() => fileInputRef.current.click()} onDragOver={onDragOver}>
          <div className="landing-content">
            <h1 className="landing-title">kecilin lagu</h1>
            <p className="landing-sub">Drop audio file di sini atau klik untuk memilih</p>
            <div className="supported-formats">FLAC • MP3 • M4A • WAV • OGG • OPUS • ALAC • AIFF</div>
          </div>
          <input type="file" multiple accept="audio/*" ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell ${isDragging ? 'dragging' : ''}`} onDragOver={onDragOver} onDragLeave={() => setIsDragging(false)} onDrop={onDrop} style={{ '--accent': accentColor }}>
      {/* Notifikasi Ringan */}
      {notification && <div className="toast-notification">{notification}</div>}

      <div className="glass-container">
        {/* HEADER */}
        <header className="app-header">
          <span className="app-name">kecilin lagu</span>
          <div className="header-actions">
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
            Add Files
          </button>
          <button className="btn btn-primary" disabled={isProcessing || !items.some((i) => i.status === 'waiting')} onClick={startConversion}>
            Start Convert
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
                  Encoding {currentItem.file.name}
                  <div className="track-detail-small">
                    {(currentItem.file.size / (1024 * 1024)).toFixed(2)} MB • {currentItem.options.format.toUpperCase()}
                  </div>
                </>
              ) : isProcessing ? (
                'Memuat Engine...'
              ) : (
                'Siap Menunggu'
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
          <div className="section-title">FILE QUEUE</div>
          <div className="queue-list">
            {items.map((item, index) => (
              <div key={item.id} className="queue-item">
                <span className="queue-index">{(index + 1).toString().padStart(2, '0')}</span>
                <span className="queue-name">{item.file.name}</span>
                <span className={`queue-status badge-${item.status}`}>
                  {item.status === 'completed' && 'done ✓'}
                  {item.status === 'processing' && 'converting'}
                  {item.status === 'waiting' && 'waiting'}
                  {item.status === 'error' && 'error'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* OUTPUT SETTINGS & INFO */}
        <section className="output-area">
          <div className="section-title">OUTPUT & INFO</div>
          <div className="output-grid">
            <div className="output-item">
              <span className="label">Format:</span>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="inline-select">
                {Object.keys(formatOptions).map((k) => (
                  <option key={k} value={k}>
                    {formatOptions[k].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="output-item">
              <span className="label">Bitrate Target:</span>
              <span>{formatOptions[format].bitrate}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Converter;
