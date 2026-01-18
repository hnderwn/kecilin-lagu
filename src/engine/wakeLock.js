/**
 * Utility to keep the screen on during conversion
 */
export const requestWakeLock = async () => {
  if ('wakeLock' in navigator) {
    try {
      const wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake Lock is active');
      return wakeLock;
    } catch (err) {
      console.error(`${err.name}, ${err.message}`);
    }
  } else {
    console.warn('Wake Lock API not supported');
  }
  return null;
};

export const releaseWakeLock = (wakeLock) => {
  if (wakeLock) {
    wakeLock.release().then(() => {
      console.log('Wake Lock released');
    });
  }
};
