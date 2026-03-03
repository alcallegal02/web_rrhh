// Detect protocol automatically (works with both HTTP and HTTPS)
const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = window.location.hostname;
const currentPort = window.location.port;

// If accessing directly via port 4200 (dev server), use relative URLs (proxy handles routing)
// Otherwise use the current port (for production or Nginx proxy)
const isDevDirect = currentPort === '4200';
// When accessing via 4200, use relative URLs (proxy will handle), otherwise construct full URL
const apiPort = isDevDirect ? '' : (currentPort ? `:${currentPort}` : '');

// Construct API URLs
// In dev direct mode (port 4200), use relative URLs so Angular proxy can handle them
// We strictly ignore __env in dev mode to avoid Docker/Nginx configuration leaking into local dev
const baseApiUrl = isDevDirect ? '/api' : ((window as any).__env?.API_URL || `${protocol}//${host}${apiPort}/api`);
const baseWsUrl = isDevDirect ? '/ws' : ((window as any).__env?.WS_URL || `${wsProtocol}//${host}${apiPort}/ws`);

export const environment = {
  apiUrl: baseApiUrl,
  wsUrl: baseWsUrl,
  production: false
};

