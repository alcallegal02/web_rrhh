#!/usr/bin/env node
// Start Angular development server with environment variables

const { spawn } = require('child_process');

const host = process.env.NG_SERVE_HOST || '0.0.0.0';
const port = process.env.NG_SERVE_PORT || '4200';

const args = [
  'serve',
  '--host', host,
  '--port', port,
  '--poll', '2000',
  '--disable-host-check'
];

console.log(`Starting Angular dev server on ${host}:${port}...`);

const ng = spawn('ng', args, {
  stdio: 'inherit',
  shell: true
});

ng.on('error', (err) => {
  console.error('Failed to start Angular dev server:', err);
  process.exit(1);
});

ng.on('exit', (code) => {
  process.exit(code);
});

