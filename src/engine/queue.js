import { initFFmpeg, convertAudio, terminateEngine } from './ffmpegEngine';
import { triggerDownload } from '../utils/download';
import { requestWakeLock, releaseWakeLock } from './wakeLock';

export class ConversionQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.isPaused = false;
    this.processedCount = 0;
    this.wakeLock = null;
    this.onStatusChange = () => {};
    this.lastUpdate = 0;
    this.namingTemplate = '[NAME]_kecil';
    this.isNamingActive = false; // Default: OFF
  }

  addFiles(files, options = { format: 'm4a', bitrate: '256k', metadata: {} }, autoStart = false) {
    const newItems = Array.from(files).map((file) => {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      return {
        file,
        options: {
          ...options,
          metadata: {
            title: nameWithoutExt, // Default title dari nama file
            artist: '',
            album: '',
            ...options.metadata,
          },
        },
        status: 'waiting',
        progress: 0,
        id: Math.random().toString(36).substr(2, 9),
      };
    });
    this.queue = [...this.queue, ...newItems];

    if (autoStart) {
      this.processNext();
    }

    this.emitStatus();
    return newItems;
  }

  removeItem(id) {
    const item = this.queue.find((i) => i.id === id);
    if (item && item.status === 'processing') return false;

    this.queue = this.queue.filter((i) => i.id !== id);
    this.emitStatus();
    return true;
  }

  clearQueue() {
    if (this.isProcessing) return false;
    this.queue = [];
    this.emitStatus();
    return true;
  }

  updateAllOptions(options) {
    this.queue = this.queue.map((item) => {
      if (item.status === 'waiting') {
        const currentMetadata = item.options.metadata || {};
        return {
          ...item,
          options: {
            ...options,
            metadata: { ...currentMetadata },
          },
        };
      }
      return item;
    });
    this.emitStatus();
  }

  updateItemOptions(id, options) {
    this.queue = this.queue.map((item) => {
      if (item.id === id) {
        return { ...item, options: { ...item.options, ...options } };
      }
      return item;
    });
    this.emitStatus();
  }

  setNamingTemplate(template) {
    this.namingTemplate = template;
    this.emitStatus();
  }

  setNamingActive(active) {
    this.isNamingActive = active;
    this.emitStatus();
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    this.emitStatus(); // Update UI dulu
    if (!this.isPaused) {
      this.processNext();
    }
  }

  // Helper untuk emit status lengkap (queue + pause state)
  emitStatus() {
    this.onStatusChange([...this.queue], {
      isPaused: this.isPaused,
      namingTemplate: this.namingTemplate,
      isNamingActive: this.isNamingActive,
    });
  }

  async processNext() {
    if (this.isProcessing || this.isPaused || this.queue.length === 0) return;

    const nextItem = this.queue.find((item) => item.status === 'waiting');
    if (!nextItem) {
      if (this.wakeLock) {
        releaseWakeLock(this.wakeLock);
        this.wakeLock = null;
      }
      return;
    }

    this.isProcessing = true;
    nextItem.status = 'processing';
    this.emitStatus();

    try {
      if (!this.wakeLock) {
        this.wakeLock = await requestWakeLock();
      }

      // Memastikan FFmpeg siap
      await initFFmpeg();

      // Jalankan konversi dengan callback progres yang diikat langsung ke item ini
      const { data, extension, mimeType } = await convertAudio(nextItem.file, nextItem.options, (progressPercent) => {
        nextItem.progress = progressPercent;

        // Throttling adaptif: jika antrean panjang (>25), kurangi update ke 500ms untuk menghemat CPU
        const throttleInterval = this.queue.length > 25 ? 500 : 150;

        const now = Date.now();
        if (now - this.lastUpdate > throttleInterval) {
          this.emitStatus();
          this.lastUpdate = now;
        }
      });

      // Generate output name
      const baseName = nextItem.file.name.replace(/\.[^/.]+$/, '');
      let outputName = `${baseName}.${extension}`; // Default: nama asli

      if (this.isNamingActive) {
        const sanitizedTemplate = this.namingTemplate.replace(/[\\/:*?"<>|]/g, '');
        const processed = sanitizedTemplate.replace('[NAME]', baseName).replace('[BITRATE]', nextItem.options.bitrate).replace('[EXT]', extension);

        if (processed && processed !== sanitizedTemplate) {
          outputName = processed;
          if (!outputName.endsWith(`.${extension}`)) {
            outputName += `.${extension}`;
          }
        }
      }

      triggerDownload(data, outputName, mimeType);

      nextItem.status = 'completed';
      nextItem.progress = 100;
      this.processedCount++;

      // Engine Recycling: Tiap 30 file, matikan engine & nyalakan lagi untuk bersihkan RAM
      if (this.processedCount >= 30) {
        console.log('[Queue] Mendaur ulang engine untuk membersihkan memori...');
        // Kita tidak 'await' secara kaku di sini agar tidak menghambat siklus queue,
        // tapi kita pastikan terminate selesai sebelum lagu selanjutnya memanggil init
        await terminateEngine();
        this.processedCount = 0;
        // Opsional: Langsung trigger initFFmpeg di sini untuk pre-loading
        initFFmpeg().catch(console.error);
      }
    } catch (error) {
      console.error('Konversi gagal:', error);
      nextItem.status = 'error';
    } finally {
      this.isProcessing = false;
      this.emitStatus();
      this.processNext();
    }
  }

  getQueue() {
    return this.queue;
  }
}

export const conversionQueue = new ConversionQueue();
