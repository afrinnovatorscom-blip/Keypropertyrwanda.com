import config from '../config/environment.js';

const silent = config.isTest;

function write(level, message, meta) {
  if (silent && level !== 'error') return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  const out = level === 'error' ? console.error : console.log;
  if (meta !== undefined) out(line, meta);
  else out(line);
}

export const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};

export default logger;
