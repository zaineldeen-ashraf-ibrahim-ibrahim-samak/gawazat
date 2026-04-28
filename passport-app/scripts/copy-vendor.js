#!/usr/bin/env node

/**
 * Copy Bootstrap vendor CSS files to renderer/styles/vendor/
 * This ensures Bootstrap CSS is bundled locally and not fetched from CDN (SC-006).
 */

const fs = require('fs');
const path = require('path');

const vendorStylesDir = path.join(__dirname, '..', 'renderer', 'styles', 'vendor');
const vendorScriptsDir = path.join(__dirname, '..', 'renderer', 'vendor');
const nodeModulesBootstrap = path.join(__dirname, '..', 'node_modules', 'bootstrap', 'dist', 'css');
const nodeModulesI18next = path.join(__dirname, '..', 'node_modules', 'i18next', 'dist', 'umd');

// Ensure vendor directories exist
if (!fs.existsSync(vendorStylesDir)) {
  fs.mkdirSync(vendorStylesDir, { recursive: true });
}
if (!fs.existsSync(vendorScriptsDir)) {
  fs.mkdirSync(vendorScriptsDir, { recursive: true });
}

// Copy bootstrap.rtl.min.css
const rtlSource = path.join(nodeModulesBootstrap, 'bootstrap.rtl.min.css');
const rtlDest = path.join(vendorStylesDir, 'bootstrap.rtl.min.css');
if (fs.existsSync(rtlSource)) {
  fs.copyFileSync(rtlSource, rtlDest);
  console.log('✓ Copied bootstrap.rtl.min.css');
}

// Copy bootstrap.min.css (LTR)
const ltrSource = path.join(nodeModulesBootstrap, 'bootstrap.min.css');
const ltrDest = path.join(vendorStylesDir, 'bootstrap.min.css');
if (fs.existsSync(ltrSource)) {
  fs.copyFileSync(ltrSource, ltrDest);
  console.log('✓ Copied bootstrap.min.css');
}

// Copy i18next.min.js
const i18nSource = path.join(nodeModulesI18next, 'i18next.min.js');
const i18nDest = path.join(vendorScriptsDir, 'i18next.min.js');
if (fs.existsSync(i18nSource)) {
  fs.copyFileSync(i18nSource, i18nDest);
  console.log('✓ Copied i18next.min.js');
}
