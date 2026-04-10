let logListeners = [];
const MAX_LOGS = 500;
let logs = [];

// Bajak console asli
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

const addLog = (type, args) => {
  const message = args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');

  const newLog = {
    id: Date.now() + Math.random(),
    timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    type,
    message,
  };

  logs = [...logs, newLog].slice(-MAX_LOGS);
  logListeners.forEach((listener) => listener(logs));
};

console.log = (...args) => {
  originalLog.apply(console, args);
  addLog('info', args);
};

console.error = (...args) => {
  originalError.apply(console, args);
  addLog('error', args);
};

console.warn = (...args) => {
  originalWarn.apply(console, args);
  addLog('warn', args);
};

export const subscribeToLogs = (callback) => {
  logListeners.push(callback);
  callback(logs);
  return () => {
    logListeners = logListeners.filter((l) => l !== callback);
  };
};

export const getLogs = () => logs;
export const clearLogs = () => {
  logs = [];
  logListeners.forEach((listener) => listener(logs));
};
