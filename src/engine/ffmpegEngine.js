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

let initPromise = null;

export const initFFmpeg = async () => {
  if (ffmpeg && loadStatus === 'ready') return ffmpeg;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    updateStatus('loading');
    try {
      const newFfmpeg = new FFmpeg();
      window.ff = newFfmpeg; // Ekspos segera untuk debug

      // Menangkap log dari FFmpeg untuk debugging.
      newFfmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg Log]', message);
      });

      // Memuat resource inti FFmpeg dari file lokal (public folder)
      // Ini lebih stabil untuk PWA dan mendukung mode offline berkala.
      const coreURL = await toBlobURL('/ffmpeg-core.js', 'text/javascript');
      const wasmURL = await toBlobURL('/ffmpeg-core.wasm', 'application/wasm');

      await newFfmpeg.load({
        coreURL,
        wasmURL,
      });

      // Ekspos ke global untuk debugging di console (window.ff)
      window.ff = newFfmpeg;
      console.log('[FFmpeg Engine] Ready. Use window.ff for debugging.');

      ffmpeg = newFfmpeg;
      updateStatus('ready');
      return ffmpeg;
    } catch (error) {
      updateStatus('error');
      console.error('FFmpeg failed to load:', error);
      ffmpeg = null; // Reset agar bisa re-try
      throw error;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
};

export const resetEngine = () => {
  ffmpeg = null;
  updateStatus('idle');
  initFFmpeg();
};

/**
 * Mematikan engine FFmpeg secara total untuk mengosongkan memori.
 */
export const terminateEngine = async () => {
  if (ffmpeg) {
    try {
      await ffmpeg.terminate();
    } catch (e) {
      console.warn('Gagal terminate engine:', e);
    }
    ffmpeg = null;
    updateStatus('idle');
  }
};

/**
 * Mengambil informasi file (terutama bitrate) sebelum konversi.
 */
export const getFileInfo = async (file) => {
  if (!ffmpeg) await initFFmpeg();

  const tempName = `info_${Math.random().toString(36).substr(2, 5)}`;
  await ffmpeg.writeFile(tempName, await fetchFile(file));

  let bitrate = 0;
  let title = '';
  let artist = '';
  let album = '';
  let genre = '';
  let year = '';
  let track = '';
  let hasLyrics = false;

  const logHandler = ({ message }) => {
    // Cari Bitrate
    const brMatch = message.match(/bitrate: (\d+) kb\/s/);
    if (brMatch) bitrate = parseInt(brMatch[1]);

    // Cari Metadata dengan Regex
    const titleMatch = message.match(/^\s*title\s*:\s*(.+)$/i);
    const artistMatch = message.match(/^\s*artist\s*:\s*(.+)$/i);
    const albumMatch = message.match(/^\s*album\s*:\s*(.+)$/i);
    const genreMatch = message.match(/^\s*genre\s*:\s*(.+)$/i);
    const dateMatch = message.match(/^\s*(date|year)\s*:\s*(.+)$/i);
    const trackMatch = message.match(/^\s*track\s*:\s*(.+)$/i);

    if (titleMatch) title = titleMatch[1].trim();
    if (artistMatch) artist = artistMatch[1].trim();
    if (albumMatch) album = albumMatch[1].trim();
    if (genreMatch) genre = genreMatch[1].trim();
    if (dateMatch) year = dateMatch[2].trim();
    if (trackMatch) track = trackMatch[1].trim();

    // Deteksi keberadaan lirik bawaan
    const msgLower = message.toLowerCase();
    if (msgLower.includes('lyrics') || msgLower.includes('subtitle:')) {
      hasLyrics = true;
    }
  };

  ffmpeg.on('log', logHandler);
  try {
    await ffmpeg.exec(['-i', tempName]);
  } catch (e) {
    // Error diabaikan karena FFmpeg berhenti tanpa output
  }
  ffmpeg.off('log', logHandler);
  await ffmpeg.deleteFile(tempName);

  return { bitrate, title, artist, album, genre, year, track, hasLyrics };
};

/**
 * Konversi file audio ke format target.
 * @param {File} file - File input.
 * @param {Object} options - Pengaturan target.
 * @param {Function} onProgress - Callback progres konversi.
 */
export const convertAudio = async (file, options = { format: 'm4a', bitrate: '160k', metadata: {} }, onProgress = () => {}) => {
  if (!ffmpeg || loadStatus !== 'ready') await initFFmpeg();

  // Reset/pasang listener progres spesifik untuk file ini
  const progressHandler = ({ progress }) => {
    onProgress(progress * 100);
  };
  ffmpeg.on('progress', progressHandler);

  try {
    const { format, bitrate, metadata, coverFile, stripMetadata, keepLyrics } = options;
    const ext = file.name.split('.').pop().toLowerCase();
    const inputName = `input_${Math.random().toString(36).substr(2, 5)}.${ext}`;
    const outputName = `output_${Math.random().toString(36).substr(2, 5)}.${format}`;

    console.log(`[FFmpeg] Processing: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Tulis file utama ke Virtual FS
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // 1. LAKUKAN PROBE CEPAT UNTUK MENDETEKSI COVER ART & EKSTRAK METADATA ASLI SECARA HARDCOPY
    let hasOriginalCover = false;
    let extractedMeta = { title: '', artist: '', album: '', genre: '', year: '', track: '' };

    const probeLogHandler = ({ message }) => {
      const msgLower = message.toLowerCase();
      if ((msgLower.includes('video:') || msgLower.includes('stream #0:')) && (msgLower.includes('mjpeg') || msgLower.includes('png') || msgLower.includes('jpeg'))) {
        hasOriginalCover = true;
      }

      // Ekstrak tag asli karena -map_metadata FFmpeg terkadang gagal di WASM
      // Kita hapus '^' karena beberapa ffmpeg build menaruh prefix log seperti "[info]   title : ..."
      const titleMatch = message.match(/\btitle\s*:\s*(.+)/i);
      const artistMatch = message.match(/\bartist\s*:\s*(.+)/i);
      const albumMatch = message.match(/\balbum\s*:\s*(.+)/i);
      const genreMatch = message.match(/\bgenre\s*:\s*(.+)/i);
      const dateMatch = message.match(/\b(?:date|year)\s*:\s*(.+)/i);
      const trackMatch = message.match(/\btrack\s*:\s*(.+)/i);

      if (titleMatch && !extractedMeta.title) extractedMeta.title = titleMatch[1].trim();
      if (artistMatch && !extractedMeta.artist) extractedMeta.artist = artistMatch[1].trim();
      if (albumMatch && !extractedMeta.album) extractedMeta.album = albumMatch[1].trim();
      if (genreMatch && !extractedMeta.genre) extractedMeta.genre = genreMatch[1].trim();
      if (dateMatch && !extractedMeta.year) extractedMeta.year = dateMatch[1].trim();
      if (trackMatch && !extractedMeta.track) extractedMeta.track = trackMatch[1].trim();
    };

    ffmpeg.on('log', probeLogHandler);
    try {
      await ffmpeg.exec(['-i', inputName]); // Eksekusi probe kilat
    } catch(e) {} // Diabaikan karena tanpa output pasti error exit
    ffmpeg.off('log', probeLogHandler);

    let args = ['-i', inputName];

    // Jika ada custom cover, muat ke memori
    if (coverFile) {
      await ffmpeg.writeFile('cover.jpg', await fetchFile(coverFile));
      args.push('-i', 'cover.jpg');
    }

    // Pemetaan Metadata & ID3 yang Agresif agar tidak bocor
    if (stripMetadata) {
      args.push('-map_metadata', '-1');
    } else {
      args.push('-map_metadata', '0');       // Kopi tag global
      args.push('-map_metadata:s:a', '0:s:a'); // Kopi tag audio
    }

    // Pemetaan Streams
    args.push('-map', '0:a:0'); // Selalu ambil audio asli pertama (mencegah double audio stream)
    if (coverFile) {
      args.push('-map', '1'); // Map cover gambar manual
    } else if (!stripMetadata && hasOriginalCover) {
      args.push('-map', '0:v:0?'); // Map artwork bawaan pertama jika ada
    }

    // Sinkronisasi Metadata gabungan antara JS/Editor pengguna dan hasil Probe asli
    if (!stripMetadata) {
      // HANYA ambil judul dari file name JIKA file asli sama sekali tidak punya judul DAN tidak diedit pengguna
      const probeOrFallbackTitle = extractedMeta.title ? extractedMeta.title : file.name.replace(/\.[^/.]+$/, '');
      const finalTitle = metadata?.title !== undefined && metadata.title !== '' ? metadata.title : probeOrFallbackTitle;
      
      const finalArtist = metadata?.artist !== undefined && metadata.artist !== '' ? metadata.artist : extractedMeta.artist;
      const finalAlbum = metadata?.album !== undefined && metadata.album !== '' ? metadata.album : extractedMeta.album;
      const finalGenre = metadata?.genre !== undefined && metadata.genre !== '' ? metadata.genre : extractedMeta.genre;
      const finalYear = metadata?.year !== undefined && metadata.year !== '' ? metadata.year : extractedMeta.year;
      const finalTrack = metadata?.track !== undefined && metadata.track !== '' ? metadata.track : extractedMeta.track;

      if (finalTitle) args.push('-metadata', `title=${finalTitle}`);
      if (finalArtist) args.push('-metadata', `artist=${finalArtist}`);
      if (finalAlbum) args.push('-metadata', `album=${finalAlbum}`);
      if (finalGenre) args.push('-metadata', `genre=${finalGenre}`);
      if (finalYear) args.push('-metadata', `date=${finalYear}`);
      if (finalTrack) args.push('-metadata', `track=${finalTrack}`);
    }

    // Logika Auto Square Crop
    const brNum = parseInt(bitrate);
    let artSize = 600; // Default
    if (brNum <= 128) artSize = 500;
    if (brNum >= 320) artSize = 800;

    // Untuk memastikan cover art raksasa tidak membocorkan memori WebAssembly atau gagal dikonversi,
    // kita secara eksplisit menjalankan filter kompresi dan resize gambar menjadi bujursangkar,
    // baik untuk custom cover maupun cover bawaan (original cover).
    let videoArgs = [];
    const filterArt = `crop='min(iw,ih)':'min(iw,ih)',scale=${artSize}:${artSize}`;
    
    if (coverFile) {
      videoArgs = ['-vf', filterArt, '-c:v', 'mjpeg', '-q:v', '5', '-disposition:v', 'attached_pic', '-vframes', '1', '-fps_mode', 'vfr'];
    } else if (hasOriginalCover && !stripMetadata) {
      videoArgs = ['-vf', filterArt, '-c:v', 'mjpeg', '-q:v', '5', '-disposition:v', 'attached_pic', '-vframes', '1', '-fps_mode', 'vfr'];
    }

    if (format === 'm4a') {
      args.push('-c:a', 'aac', '-b:a', bitrate, ...videoArgs);
    } else if (format === 'mp3') {
      args.push('-c:a', 'libmp3lame', '-b:a', bitrate, ...videoArgs);
      if (keepLyrics !== false && !stripMetadata) args.push('-id3v2_version', '3');
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
    if (coverFile) {
      try { await ffmpeg.deleteFile('cover.jpg'); } catch (e) {}
    }

    const mimeTypes = {
      m4a: 'audio/mp4',
      mp3: 'audio/mpeg',
    };

    const result = {
      data,
      extension: format,
      mimeType: mimeTypes[format] || 'application/octet-stream',
    };

    // Bersihkan buffer lokal segera setelah dipindahkan ke result
    return result;
  } catch (err) {
    console.error('[FFmpeg Error Detail]', err);
    throw err;
  } finally {
    // Lepaskan listener agar tidak bertumpuk atau salah target
    if (ffmpeg) ffmpeg.off('progress', progressHandler);
  }
};
