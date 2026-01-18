export const getDeviceInfo = () => {
  const ram = navigator.deviceMemory || 'Unknown';
  const cores = navigator.hardwareConcurrency || 'Unknown';
  
  return {
    ram,
    cores,
    isLowEnd: (typeof ram === 'number' && ram <= 4)
  };
};

export const checkSupport = () => {
  const hasWasm = typeof WebAssembly === 'object';
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
  
  return {
    hasWasm,
    hasSharedArrayBuffer,
    isCompatible: hasWasm
  };
};
