import { initFFmpeg, convertAudio } from './ffmpegEngine';
import { triggerDownload } from '../utils/download';
import { requestWakeLock, releaseWakeLock } from './wakeLock';

export class ConversionQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.wakeLock = null;
    this.onStatusChange = () => {};
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
      const { data, extension } = await convertAudio(nextItem.file, nextItem.options, (progressPercent) => {
        nextItem.progress = progressPercent;
        this.onStatusChange([...this.queue]);
      });

      const outputName = nextItem.file.name.replace(/\.[^/.]+$/, '') + `.${extension}`;
      triggerDownload(data, outputName);

      nextItem.status = 'completed';
      nextItem.progress = 100;
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
