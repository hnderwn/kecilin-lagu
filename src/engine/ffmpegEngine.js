import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;

export const initFFmpeg = async (onProgress = () => {}) => {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();
  
  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg Log]', message);
  });

  ffmpeg.on('progress', ({ progress, time }) => {
    onProgress(progress * 100);
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
};

/**
 * @param {File} file 
 * @param {Object} options
 * @param {string} options.format - 'm4a' | 'mp3' | 'opus'
 * @param {string} options.bitrate - e.g. '256k'
 * @returns {Promise<{data: Uint8Array, extension: string}>}
 */
export const convertFlacToAac = async (file, options = { format: 'm4a', bitrate: '256k' }) => {
  if (!ffmpeg) throw new Error('FFmpeg not initialized');

  const { format, bitrate } = options;
  const inputName = 'input.flac';
  const outputName = `output.${format}`;

  // Write file to virtual FS
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const args = [
    '-i', inputName,
    '-map_metadata', '0',
    '-map', '0:a',
    '-map', '0:v?',
  ];

  if (format === 'm4a') {
    args.push('-c:a', 'aac', '-b:a', bitrate, '-c:v', 'copy');
  } else if (format === 'mp3') {
    args.push('-c:a', 'libmp3lame', '-b:a', bitrate, '-c:v', 'copy');
  } else if (format === 'opus') {
    // Opus in WebA container usually, or .opus
    args.push('-c:a', 'libopus', '-b:a', bitrate, '-c:v', 'copy');
  }

  args.push(outputName);

  await ffmpeg.exec(args);

  // Read result
  const data = await ffmpeg.readFile(outputName);

  // Cleanup virtual FS
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  return { data, extension: format };
};
