try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }

module.exports = {
  appId: process.env.APP_ID || 'eg.portsaid.gawazat',
  productName: process.env.APP_NAME_EN || process.env.APP_NAME || 'Passenger Gate',
  defaultArch: 'x64',
  directories: {
    output: 'dist',
  },
  win: {
    target: ['nsis'],
    icon: process.env.APP_ICON || 'renderer/assets/icon.ico',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerLanguages: ['ar', 'en'],
    perMachine: false,
    shortcutName: process.env.APP_NAME || process.env.APP_NAME_EN || 'Passenger Gate',
    uninstallDisplayName: `${process.env.APP_NAME || process.env.APP_NAME_EN || 'Passenger Gate'} ${require('./package.json').version}`,
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
