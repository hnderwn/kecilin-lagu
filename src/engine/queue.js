import { initFFmpeg, convertFlacToAac } from './ffmpegEngine';
import { triggerDownload } from '../utils/download';
import { requestWakeLock, releaseWakeLock } from './wakeLock';

export class ConversionQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.wakeLock = null;
    this.onStatusChange = () => {};
    this.onFileComplete = () => {};
  }

  addFiles(files, options = { format: 'm4a', bitrate: '256k' }, autoStart = false) {
    const newItems = Array.from(files).map(file => ({
      file,
      options,
      status: 'waiting',
      progress: 0,
      id: Math.random().toString(36).substr(2, 9)
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

    const nextItem = this.queue.find(item => item.status === 'waiting');
    if (!nextItem) {
      if (this.wakeLock) {
        releaseWakeLock(this.wakeLock);
        this.wakeLock = null;
      }
      return;
    }

    this.isProcessing = true;
    nextItem.status = 'processing';
    this.onStatusChange(this.queue);

    try {
      if (!this.wakeLock) {
        this.wakeLock = await requestWakeLock();
      }

      const ffmpeg = await initFFmpeg((progress) => {
        nextItem.progress = progress;
        this.onStatusChange([...this.queue]);
      });

      const { data, extension } = await convertFlacToAac(nextItem.file, nextItem.options);
      
      const outputName = nextItem.file.name.replace(/\.[^/.]+$/, "") + `.${extension}`;
      triggerDownload(data, outputName);

      nextItem.status = 'completed';
      nextItem.progress = 100;
    } catch (error) {
      console.error('Conversion failed', error);
      nextItem.status = 'error';
    } finally {
      this.isProcessing = false;
      this.onFileComplete(nextItem);
      this.onStatusChange([...this.queue]);
      this.processNext();
    }
  }

  getQueue() {
    return this.queue;
  }
}

export const conversionQueue = new ConversionQueue();
