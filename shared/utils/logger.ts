export const log = (message: string, data?: unknown) =>
  data !== undefined ? console.log(message, data) : console.log(message);

export const logWarn = (message: string, data?: unknown) =>
  data !== undefined ? console.warn(message, data) : console.warn(message);

export const logError = (message: string, data?: unknown) =>
  data !== undefined ? console.error(message, data) : console.error(message);

export const logInfo = (message: string, data?: unknown) =>
  data !== undefined ? console.info(message, data) : console.info(message);
