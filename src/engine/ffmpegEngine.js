import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

/**
 * Variabel global untuk menyimpan instance FFmpeg agar bisa digunakan kembali.
 */
let ffmpeg = null;

/**
 * Inisialisasi FFmpeg WASM.
 */
export const initFFmpeg = async () => {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();

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

  return ffmpeg;
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

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const args = ['-i', inputName, '-map_metadata', '0', '-map', '0:a', '-map', '0:v?'];

    if (format === 'm4a') {
      args.push('-c:a', 'aac', '-b:a', bitrate, '-c:v', 'copy');
    } else if (format === 'mp3') {
      args.push('-c:a', 'libmp3lame', '-b:a', bitrate, '-c:v', 'copy');
    } else if (format === 'opus') {
      args.push('-c:a', 'libopus', '-b:a', bitrate, '-c:v', 'copy');
    }

    args.push(outputName);
    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile(outputName);
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    return { data, extension: format };
  } finally {
    // Lepaskan listener agar tidak bertumpuk atau salah target
    ffmpeg.off('progress', progressHandler);
  }
};
