#!/usr/bin/env node

/**
 * Copy Bootstrap vendor CSS files to renderer/styles/vendor/
 * This ensures Bootstrap CSS is bundled locally and not fetched from CDN (SC-006).
 */

const fs = require('fs');
const path = require('path');

const vendorDir = path.join(__dirname, '..', 'renderer', 'styles', 'vendor');
const nodeModulesBootstrap = path.join(__dirname, '..', 'node_modules', 'bootstrap', 'dist', 'css');

// Ensure vendor directory exists
if (!fs.existsSync(vendorDir)) {
  fs.mkdirSync(vendorDir, { recursive: true });
}

// Copy bootstrap.rtl.min.css
const rtlSource = path.join(nodeModulesBootstrap, 'bootstrap.rtl.min.css');
const rtlDest = path.join(vendorDir, 'bootstrap.rtl.min.css');
if (fs.existsSync(rtlSource)) {
  fs.copyFileSync(rtlSource, rtlDest);
  console.log('✓ Copied bootstrap.rtl.min.css');
}

// Copy bootstrap.min.css (LTR)
const ltrSource = path.join(nodeModulesBootstrap, 'bootstrap.min.css');
const ltrDest = path.join(vendorDir, 'bootstrap.min.css');
if (fs.existsSync(ltrSource)) {
  fs.copyFileSync(ltrSource, ltrDest);
  console.log('✓ Copied bootstrap.min.css');
}
