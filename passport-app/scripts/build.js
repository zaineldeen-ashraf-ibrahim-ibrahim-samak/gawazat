#!/usr/bin/env node
try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }
const { spawn } = require('child_process');
const path = require('path');

const args = ['--config', 'electron-builder.config.js', ...process.argv.slice(2)];
const bin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder'
);

const child = spawn(bin, args, { stdio: 'inherit', env: process.env, shell: true });
child.on('exit', (code) => process.exit(code ?? 1));