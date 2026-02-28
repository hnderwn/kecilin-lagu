import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

/**
 * Variabel global untuk menyimpan instance FFmpeg agar bisa digunakan kembali.
 */
let ffmpeg = null;
let loadStatus = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'
let onStatusUpdate = null;

export const setEngineStatusListener = (callback) => {
  onStatusUpdate = callback;
  if (callback) callback(loadStatus);
};

const updateStatus = (status) => {
  loadStatus = status;
  if (onStatusUpdate) onStatusUpdate(status);
};

/**
 * Inisialisasi FFmpeg WASM.
 */
export const initFFmpeg = async () => {
  if (ffmpeg && loadStatus === 'ready') return ffmpeg;

  updateStatus('loading');

  try {
    ffmpeg = new FFmpeg();
    window.ff = ffmpeg; // Ekspos segera untuk debug

    // Menangkap log dari FFmpeg untuk debugging.
    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg Log]', message);
    });

    // Memuat resource inti FFmpeg dari CDN.
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    // Ekspos ke global untuk debugging di console (window.ff)
    window.ff = ffmpeg;
    console.log('[FFmpeg Engine] Ready. Use window.ff for debugging.');

    // Cek format & codec yang tersedia (untuk debugging di console)
    // ffmpeg.exec(['-codecs']);

    updateStatus('ready');
    return ffmpeg;
  } catch (error) {
    updateStatus('error');
    console.error('FFmpeg failed to load:', error);
    ffmpeg = null; // Reset agar bisa re-try
    throw error;
  }
};

/**
 * Reset status mesin untuk inisialisasi ulang.
 */
export const resetEngine = () => {
  ffmpeg = null;
  updateStatus('idle');
  initFFmpeg();
};

/**
 * Mengambil informasi file (terutama bitrate) sebelum konversi.
 */
export const getFileInfo = async (file) => {
  if (!ffmpeg) await initFFmpeg();

  const tempName = `info_${Math.random().toString(36).substr(2, 5)}`;
  await ffmpeg.writeFile(tempName, await fetchFile(file));

  let bitrate = 0;
  const logHandler = ({ message }) => {
    const match = message.match(/bitrate: (\d+) kb\/s/);
    if (match) bitrate = parseInt(match[1]);
  };

  ffmpeg.on('log', logHandler);
  try {
    await ffmpeg.exec(['-i', tempName]);
  } catch (e) {
    // Error diharapkan karena tidak ada output file.
  }
  ffmpeg.off('log', logHandler);
  await ffmpeg.deleteFile(tempName);

  return { bitrate };
};

/**
 * Konversi file audio ke format target.
 * @param {File} file - File input.
 * @param {Object} options - Pengaturan target.
 * @param {Function} onProgress - Callback progres konversi.
 */
export const convertAudio = async (file, options = { format: 'm4a', bitrate: '256k' }, onProgress = () => {}) => {
  if (!ffmpeg) await initFFmpeg();

  // Reset/pasang listener progres spesifik untuk file ini
  const progressHandler = ({ progress }) => {
    onProgress(progress * 100);
  };
  ffmpeg.on('progress', progressHandler);

  try {
    const { format, bitrate } = options;
    const ext = file.name.split('.').pop().toLowerCase();
    const inputName = `input_${Math.random().toString(36).substr(2, 5)}.${ext}`;
    const outputName = `output_${Math.random().toString(36).substr(2, 5)}.${format}`;

    console.log(`[FFmpeg] Processing: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Tulis file ke Virtual FS
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Gunakan mapping standar: Audio + Album Art (jika ada)
    const args = ['-i', inputName, '-map_metadata', '0', '-map', '0:a', '-map', '0:v?'];

    // Logika Smart Adaptive untuk Artwork
    const brNum = parseInt(bitrate);
    let artSize = 600; // Default
    if (brNum <= 128) artSize = 500;
    if (brNum >= 320) artSize = 800;

    const filterArt = `scale=${artSize}:${artSize}:force_original_aspect_ratio=decrease,pad=${artSize}:${artSize}:(ow-iw)/2:(oh-ih)/2`;

    if (format === 'm4a') {
      args.push('-c:a', 'aac', '-b:a', bitrate, '-vf', filterArt, '-c:v', 'mjpeg', '-q:v', '5');
    } else if (format === 'mp3') {
      args.push('-c:a', 'libmp3lame', '-b:a', bitrate, '-vf', filterArt, '-c:v', 'mjpeg', '-q:v', '5', '-id3v2_version', '3');
    }

    args.push(outputName);

    console.log('[FFmpeg Executing]', args.join(' '));
    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile(outputName);

    if (!data || data.length === 0) {
      throw new Error('Konversi menghasilkan file kosong.');
    }
    console.log(`[FFmpeg] Output file size: ${(data.length / 1024 / 1024).toFixed(2)} MB`);

    // Cleanup FS
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    const mimeTypes = {
      m4a: 'audio/mp4',
      mp3: 'audio/mpeg',
    };

    return {
      data,
      extension: format,
      mimeType: mimeTypes[format] || 'application/octet-stream',
    };
  } catch (err) {
    console.error('[FFmpeg Error Detail]', err);
    throw err;
  } finally {
    // Lepaskan listener agar tidak bertumpuk atau salah target
    ffmpeg.off('progress', progressHandler);
  }
};
