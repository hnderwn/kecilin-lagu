import React, { useState, useEffect, useRef } from 'react';
import { conversionQueue } from '../engine/queue';

const Converter = () => {
  const [items, setItems] = useState([]);
  const [accentColor, setAccentColor] = useState('#14b8a6'); // Default Teal
  const [format, setFormat] = useState('m4a');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState('00:00'); // Placeholder or calculated
  const [totalTime, setTotalTime] = useState('00:00'); // Placeholder
  const fileInputRef = useRef(null);

  const formatOptions = {
    m4a: { label: 'AAC (.m4a)', bitrate: '256 kbps' },
    mp3: { label: 'MP3', bitrate: '128 kbps' },
    opus: { label: 'OPUS', bitrate: '128 kbps' }
  };

  const accents = [
    { name: 'Teal', color: '#14b8a6' },
    { name: 'Indigo', color: '#6366f1' },
    { name: 'Rose', color: '#f43f5e' },
    { name: 'Amber', color: '#f59e0b' },
    { name: 'Emerald', color: '#10b981' }
  ];

  useEffect(() => {
    conversionQueue.onStatusChange = (newQueue) => {
      setItems(newQueue);
      const active = newQueue.some(item => item.status === 'processing');
      setIsProcessing(active);
    };
  }, []);

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      // In this new design, we add files but don't start immediately?
      // Actually, my queue autostarts. I'll modify queue.js later if needed,
      // but for now let's stick to "Select -> Add -> (manual start or auto?)"
      // RancanganUI shows a "Start Convert" button.
      conversionQueue.addFiles(files, { 
        format: format, 
        bitrate: format.includes('m4a') ? '256k' : '128k' 
      });
    }
  };

  const startConversionManual = () => {
    conversionQueue.processNext();
  };

  const currentItem = items.find(item => item.status === 'processing');

  return (
    <div className="app-shell" style={{ '--accent': accentColor }}>
      <div className="glass-container">
        {/* HEADER */}
        <header className="app-header">
          <span className="app-name">kecilin lagu</span>
          <div className={`status-dot ${isProcessing ? 'pulse' : ''}`}></div>
        </header>

        {/* CONTROL AREA */}
        <section className="control-area">
          <button 
            className="btn btn-secondary" 
            onClick={() => fileInputRef.current.click()}
          >
            Select Files
          </button>
          <button 
            className="btn btn-primary" 
            disabled={items.length === 0 || isProcessing || !items.some(i => i.status === 'waiting')}
            onClick={startConversionManual}
          >
            Start Convert
          </button>
          <input 
            type="file" 
            multiple 
            accept=".flac" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
          />
        </section>

        {/* STATUS AREA */}
        <section className="status-area">
          <div className="section-title">STATUS</div>
          <div className="status-content">
            <div className="current-track">
              {currentItem ? `Encoding ${currentItem.file.name}` : (isProcessing ? 'Initializing...' : 'Idle')}
            </div>
            <div className="progress-container">
              <div 
                className="progress-bar" 
                style={{ width: `${currentItem ? currentItem.progress : 0}%` }}
              ></div>
            </div>
            <div className="time-info">
              {currentItem ? `${Math.round(currentItem.progress)}%` : '0%'}
            </div>
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
            {items.length === 0 && <div className="empty-state">No files selected</div>}
          </div>
        </section>

        {/* OUTPUT SETTINGS */}
        <section className="output-area">
          <div className="section-title">OUTPUT</div>
          <div className="output-grid">
            <div className="output-item">
              <span className="label">Format:</span>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="inline-select">
                {Object.keys(formatOptions).map(k => <option key={k} value={k}>{formatOptions[k].label}</option>)}
              </select>
            </div>
            <div className="output-item">
              <span className="label">Bitrate:</span>
              <span>{formatOptions[format].bitrate}</span>
            </div>
            <div className="output-item">
              <span className="label">Processing:</span>
              <span>Serial (1 by 1)</span>
            </div>
            <div className="output-item">
              <span className="label">Wake Lock:</span>
              <span>ON</span>
            </div>
            <div className="output-item">
              <span className="label">Accent:</span>
              <div className="accent-picker">
                {accents.map(a => (
                  <div 
                    key={a.name} 
                    className={`accent-swatch ${accentColor === a.color ? 'active' : ''}`}
                    style={{ backgroundColor: a.color }}
                    onClick={() => setAccentColor(a.color)}
                    title={a.name}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        :root {
          --bg: #0f172a;
          --card-bg: rgba(30, 41, 59, 0.7);
          --text-main: #f8fafc;
          --text-muted: #94a3b8;
          --border: rgba(255, 255, 255, 0.1);
        }
        html{
         background-color: var(--bg);  
        }

        .app-shell {
          min-height: 80vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: var(--bg);
          color: var(--text-main);
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .glass-container {
          width: 100%;
          max-width: 480px;
          background: var(--card-bg);
          backdrop-filter: blur(12px);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        /* HEADER */
        .app-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .app-name {
          font-weight: 700;
          font-size: 1.25rem;
          letter-spacing: -0.025em;
        }

        .status-dot {
          width: 12px;
          height: 12px;
          background: var(--accent);
          border-radius: 50%;
          box-shadow: 0 0 10px var(--accent);
          transition: background 0.3s, box-shadow 0.3s;
        }

        .status-dot.pulse {
          animation: pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse-ring {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        /* ACTIONS */
        .control-area {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 32px;
        }

        .btn {
          padding: 12px 16px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          font-size: 0.9rem;
        }

        .btn-primary {
          background: var(--accent);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-main);
          border: 1px solid var(--border);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        /* SECTIONS */
        .section-title {
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.1em;
          margin-bottom: 12px;
        }

        /* STATUS */
        .status-area {
          margin-bottom: 32px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .current-track {
          font-size: 0.95rem;
          margin-bottom: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .progress-container {
          height: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-bar {
          height: 100%;
          background: var(--accent);
          transition: width 0.3s ease-out;
          box-shadow: 0 0 15px var(--accent);
        }

        .time-info {
          font-size: 0.8rem;
          color: var(--text-muted);
          text-align: right;
        }

        /* QUEUE */
        .queue-area {
          margin-bottom: 32px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .queue-list {
          max-height: 200px;
          overflow-y: auto;
          scrollbar-width: thin;
        }

        .queue-item {
          display: flex;
          align-items: center;
          padding: 8px 0;
          font-size: 0.85rem;
        }

        .queue-index {
          color: var(--text-muted);
          margin-right: 12px;
          font-family: monospace;
        }

        .queue-name {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-right: 12px;
        }

        .queue-status {
          font-size: 0.75rem;
          font-weight: 600;
        }

        .badge-completed { color: var(--accent); }
        .badge-processing { color: var(--accent); font-style: italic; }
        .badge-waiting { color: var(--text-muted); }
        .badge-error { color: #f43f5e; }

        .empty-state {
          color: var(--text-muted);
          font-size: 0.85rem;
          padding: 12px 0;
        }

        /* OUTPUT */
        .output-area {
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .output-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 24px;
        }

        .output-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .label {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .output-item span:not(.label) {
          font-size: 0.85rem;
          font-weight: 500;
        }

        .inline-select {
          background: transparent;
          color: var(--text-main);
          border: none;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          outline: none;
        }

        .inline-select option {
          background: var(--bg);
        }

        /* ACCENT PICKER */
        .accent-picker {
          display: flex;
          gap: 6px;
          margin-top: 4px;
        }

        .accent-swatch {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid transparent;
          transition: transform 0.2s;
        }

        .accent-swatch.active {
          border-color: white;
          transform: scale(1.1);
        }

        .accent-swatch:hover {
          transform: scale(1.2);
        }
      `}</style>
    </div>
  );
};

export default Converter;
