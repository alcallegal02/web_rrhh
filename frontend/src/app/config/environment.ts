// Use relative URLs for port-agnostic behavior when served via Nginx.
// This ensures that if the external port changes in docker-compose, the frontend automatically detects it.
export const environment = {
  apiUrl: '/api',
  wsUrl: '/ws',
  production: true
};
