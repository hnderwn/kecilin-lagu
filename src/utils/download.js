/**
 * Trigger immediate browser download
 * @param {Uint8Array} data - File data
 * @param {string} filename - Target filename
 * @param {string} mimeType - File mime type
 */
export const triggerDownload = (data, filename, mimeType = 'audio/aac') => {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};
