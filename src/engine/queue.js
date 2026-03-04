import { initFFmpeg, convertAudio, terminateEngine } from './ffmpegEngine';
import { triggerDownload } from '../utils/download';
import { requestWakeLock, releaseWakeLock } from './wakeLock';

export class ConversionQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.processedCount = 0; // Hitung file yang sudah diproses untuk recycle engine
    this.wakeLock = null;
    this.onStatusChange = () => {};
    this.lastUpdate = 0; // Untuk throttle progress
  }

  addFiles(files, options = { format: 'm4a', bitrate: '256k' }, autoStart = false) {
    const newItems = Array.from(files).map((file) => ({
      file,
      options,
      status: 'waiting',
      progress: 0,
      id: Math.random().toString(36).substr(2, 9),
    }));
    this.queue = [...this.queue, ...newItems];

    if (autoStart) {
      this.processNext();
    }

    this.onStatusChange(this.queue);
    return newItems;
  }

  removeItem(id) {
    const item = this.queue.find((i) => i.id === id);
    if (item && item.status === 'processing') return false; // Jangan hapus yang sedang jalan

    this.queue = this.queue.filter((i) => i.id !== id);
    this.onStatusChange([...this.queue]);
    return true;
  }

  clearQueue() {
    if (this.isProcessing) return false;
    this.queue = [];
    this.onStatusChange([]);
    return true;
  }

  updateAllOptions(options) {
    this.queue = this.queue.map((item) => {
      if (item.status === 'waiting') {
        return { ...item, options: { ...options } };
      }
      return item;
    });
    this.onStatusChange([...this.queue]);
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;

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
    this.onStatusChange([...this.queue]);

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
          this.onStatusChange([...this.queue]);
          this.lastUpdate = now;
        }
      });

      const outputName = nextItem.file.name.replace(/\.[^/.]+$/, '') + `.${extension}`;
      triggerDownload(data, outputName, mimeType);

      nextItem.status = 'completed';
      nextItem.progress = 100;
      this.processedCount++;

      // Engine Recycling: Tiap 15 file, matikan engine & nyalakan lagi untuk bersihkan RAM
      if (this.processedCount >= 15) {
        console.log('[Queue] Mendaur ulang engine untuk membersihkan memori...');
        await terminateEngine();
        this.processedCount = 0;
      }
    } catch (error) {
      console.error('Konversi gagal:', error);
      nextItem.status = 'error';
    } finally {
      this.isProcessing = false;
      this.onStatusChange([...this.queue]);
      this.processNext();
    }
  }

  getQueue() {
    return this.queue;
  }
}

export const conversionQueue = new ConversionQueue();
