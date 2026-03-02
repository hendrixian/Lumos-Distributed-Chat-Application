const stripTrailingSlash = (value) => value.replace(/\/+$/, '');

const browserProtocol =
  typeof window !== 'undefined' && window.location?.protocol
    ? window.location.protocol
    : 'http:';
const browserHost =
  typeof window !== 'undefined' && window.location?.hostname
    ? window.location.hostname
    : 'localhost';

const defaultApiUrl = `${browserProtocol}//${browserHost}:8002`;
const defaultWsProtocol = browserProtocol === 'https:' ? 'wss:' : 'ws:';
const defaultWsUrl = `${defaultWsProtocol}//${browserHost}:8002`;
const viteEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

export const API_URL = stripTrailingSlash(viteEnv.VITE_API_URL || defaultApiUrl);
export const WS_URL = stripTrailingSlash(viteEnv.VITE_WS_URL || defaultWsUrl);
