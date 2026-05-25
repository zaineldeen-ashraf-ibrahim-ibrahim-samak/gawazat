try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }

module.exports = {
  appId: process.env.APP_ID || 'eg.portsaid.gawazat',
  productName: process.env.APP_NAME_EN || process.env.APP_NAME || 'Passenger Gate',
  defaultArch: 'x64',
  directories: {
    output: 'dist',
  },
  win: {
    target: ['portable'],
    icon: process.env.APP_ICON || 'renderer/assets/icon.ico',
  },
  asar: true,
  asarUnpack: ['.env'],
  files: [
    'src/**',
    'renderer/**',
    'node_modules/**',
    'package.json',
    'package-lock.json',
    '.env',
  ],
  extraResources: [
    { from: '.env', to: '.env' },
  ],
};
