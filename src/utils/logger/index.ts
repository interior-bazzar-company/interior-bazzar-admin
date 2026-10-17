import config from "../../config";

const isProd = config.MODE === "prod";

export const logger = {
  log: (...args: unknown[]) => {
    if (!isProd) console.log(...args);
  },

  info: (...args: unknown[]) => {
    if (!isProd) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (!isProd) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    // You typically want errors to always log
    console.error(...args);
  },
  debug: (...args: unknown[]) => {
    if (!isProd) console.debug(...args);
  },
};
