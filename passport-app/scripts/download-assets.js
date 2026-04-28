#!/usr/bin/env node
/**
 * download-assets.js
 * Downloads all missing required assets for the Seaport Passport Scanner.
 *   - Amiri fonts (Google Fonts) → renderer/assets/fonts/
 *   - Sound effects (generated WAV) → renderer/assets/audio/
 *   - App icon placeholder → renderer/assets/icon.ico
 *
 * Run: node scripts/download-assets.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const FONTS_DIR = path.join(ROOT, 'renderer', 'assets', 'fonts');
const AUDIO_DIR = path.join(ROOT, 'renderer', 'assets', 'audio');
const ICON_PATH = path.join(ROOT, 'renderer', 'assets', 'icon.ico');

// ─── Helpers ────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      console.log(`  ✓ Already exists: ${path.basename(dest)}`);
      return resolve();
    }

    console.log(`  ↓ Downloading: ${path.basename(dest)}...`);
    const proto = url.startsWith('https') ? https : http;

    const request = (currentUrl) => {
      proto.get(currentUrl, (res) => {
        // Follow redirects (301, 302, 303, 307, 308)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return request(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${currentUrl}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          const size = fs.statSync(dest).size;
          console.log(`  ✓ Saved: ${path.basename(dest)} (${(size / 1024).toFixed(1)} KB)`);
          resolve();
        });
        file.on('error', (err) => {
          fs.unlinkSync(dest);
          reject(err);
        });
      }).on('error', reject);
    };

    request(url);
  });
}

// ─── WAV Generator ──────────────────────────────────────────────────
// Generates a simple sine-wave WAV file (no dependencies needed)

function generateWav(filePath, frequencyHz, durationMs, volume = 0.5) {
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    console.log(`  ✓ Already exists: ${path.basename(filePath)}`);
    return;
  }

  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  // fmt sub-chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;        // Sub-chunk size
  buffer.writeUInt16LE(1, offset); offset += 2;         // PCM format
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data sub-chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  // Generate samples with fade-in/fade-out envelope
  const fadeLength = Math.floor(numSamples * 0.1); // 10% fade
  for (let i = 0; i < numSamples; i++) {
    let envelope = 1.0;
    if (i < fadeLength) envelope = i / fadeLength;                         // Fade in
    if (i > numSamples - fadeLength) envelope = (numSamples - i) / fadeLength; // Fade out

    const sample = Math.sin(2 * Math.PI * frequencyHz * (i / sampleRate));
    const value = Math.round(sample * volume * envelope * 32767);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, value)), offset);
    offset += 2;
  }

  fs.writeFileSync(filePath, buffer);
  console.log(`  ✓ Generated: ${path.basename(filePath)} (${(buffer.length / 1024).toFixed(1)} KB, ${frequencyHz}Hz, ${durationMs}ms)`);
}

// ─── Two-Tone WAV (for a nicer success chime) ───────────────────────

function generateTwoToneWav(filePath, freq1, freq2, durationMs, volume = 0.4) {
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    console.log(`  ✓ Already exists: ${path.basename(filePath)}`);
    return;
  }

  const sampleRate = 44100;
  const halfSamples = Math.floor(sampleRate * (durationMs / 2000));
  const numSamples = halfSamples * 2;
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(sampleRate * 2, offset); offset += 4;
  buffer.writeUInt16LE(2, offset); offset += 2;
  buffer.writeUInt16LE(16, offset); offset += 2;
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  const fadeLen = Math.floor(halfSamples * 0.15);
  for (let i = 0; i < numSamples; i++) {
    const freq = i < halfSamples ? freq1 : freq2;
    let env = 1.0;
    const localI = i < halfSamples ? i : i - halfSamples;
    const localLen = halfSamples;
    if (localI < fadeLen) env = localI / fadeLen;
    if (localI > localLen - fadeLen) env = (localLen - localI) / fadeLen;

    const sample = Math.sin(2 * Math.PI * freq * (i / sampleRate));
    const value = Math.round(sample * volume * env * 32767);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, value)), offset);
    offset += 2;
  }

  fs.writeFileSync(filePath, buffer);
  console.log(`  ✓ Generated: ${path.basename(filePath)} (${(buffer.length / 1024).toFixed(1)} KB, ${freq1}→${freq2}Hz, ${durationMs}ms)`);
}

// ─── ICO Generator (minimal 16×16 + 32×32 navy icon) ────────────────

function generateIco(filePath) {
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    console.log(`  ✓ Already exists: ${path.basename(filePath)}`);
    return;
  }

  // Generate a minimal 32x32 BMP-style ICO with dark navy background and gold shield
  const size = 32;
  const bpp = 32; // 32-bit RGBA
  const imageDataSize = size * size * 4;
  const andMaskSize = size * Math.ceil(size / 8); // 1-bit AND mask per row, padded to 4 bytes
  const andMaskPadded = Math.ceil(andMaskSize / 4) * 4;

  // ICO header (6 bytes) + 1 entry (16 bytes) + BMP header (40 bytes) + pixel data + AND mask
  const bmpHeaderSize = 40;
  const totalImageSize = bmpHeaderSize + imageDataSize + andMaskPadded;
  const buffer = Buffer.alloc(6 + 16 + totalImageSize);
  let offset = 0;

  // ICO header
  buffer.writeUInt16LE(0, offset); offset += 2;     // Reserved
  buffer.writeUInt16LE(1, offset); offset += 2;     // Type: ICO
  buffer.writeUInt16LE(1, offset); offset += 2;     // Count: 1 image

  // ICO directory entry
  buffer.writeUInt8(size, offset); offset += 1;     // Width
  buffer.writeUInt8(size, offset); offset += 1;     // Height
  buffer.writeUInt8(0, offset); offset += 1;        // Palette: 0 = no palette
  buffer.writeUInt8(0, offset); offset += 1;        // Reserved
  buffer.writeUInt16LE(1, offset); offset += 2;     // Color planes
  buffer.writeUInt16LE(bpp, offset); offset += 2;   // Bits per pixel
  buffer.writeUInt32LE(totalImageSize, offset); offset += 4;  // Image size
  buffer.writeUInt32LE(6 + 16, offset); offset += 4;          // Offset to image

  // BITMAPINFOHEADER
  buffer.writeUInt32LE(bmpHeaderSize, offset); offset += 4;
  buffer.writeInt32LE(size, offset); offset += 4;      // Width
  buffer.writeInt32LE(size * 2, offset); offset += 4;  // Height (doubled for ICO)
  buffer.writeUInt16LE(1, offset); offset += 2;        // Planes
  buffer.writeUInt16LE(bpp, offset); offset += 2;      // BPP
  buffer.writeUInt32LE(0, offset); offset += 4;        // Compression
  buffer.writeUInt32LE(imageDataSize + andMaskPadded, offset); offset += 4;
  buffer.writeInt32LE(0, offset); offset += 4;         // X ppi
  buffer.writeInt32LE(0, offset); offset += 4;         // Y ppi
  buffer.writeUInt32LE(0, offset); offset += 4;        // Colors used
  buffer.writeUInt32LE(0, offset); offset += 4;        // Important colors

  // Pixel data (BGRA, bottom-up)
  // Dark navy: #0b1d3a → B:58 G:29 R:11
  // Gold accent: #f4b942 → B:66 G:185 R:244
  const navy = [0x3a, 0x1d, 0x0b, 0xff];   // BGRA
  const gold = [0x42, 0xb9, 0xf4, 0xff];    // BGRA

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Create a simple shield-like shape in gold on navy
      const cx = x - size / 2;
      const cy = (size - 1 - y) - size / 2; // flip Y for bottom-up
      const inShield = (
        Math.abs(cx) <= 10 - Math.max(0, cy - 2) * 0.8 &&
        cy >= -12 && cy <= 10
      );
      const pixel = inShield ? gold : navy;
      buffer[offset++] = pixel[0]; // B
      buffer[offset++] = pixel[1]; // G
      buffer[offset++] = pixel[2]; // R
      buffer[offset++] = pixel[3]; // A
    }
  }

  // AND mask (all 0 = fully opaque)
  for (let i = 0; i < andMaskPadded; i++) {
    buffer[offset++] = 0;
  }

  fs.writeFileSync(filePath, buffer);
  console.log(`  ✓ Generated: ${path.basename(filePath)} (${(buffer.length / 1024).toFixed(1)} KB, ${size}×${size})`);
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔧 Seaport Passport Scanner — Asset Setup\n');

  // 1. Fonts
  console.log('📝 Fonts (Amiri — Arabic PDF support):');
  ensureDir(FONTS_DIR);
  await download(
    'https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUpvrIw74NL.ttf',
    path.join(FONTS_DIR, 'Amiri-Regular.ttf')
  );
  await download(
    'https://fonts.gstatic.com/s/amiri/v27/J7acnpd8CGxBHp2VkZY4xJ9CGyAa.ttf',
    path.join(FONTS_DIR, 'Amiri-Bold.ttf')
  );

  // 2. Audio
  console.log('\n🔊 Audio (scan cues):');
  ensureDir(AUDIO_DIR);
  // Success: pleasant two-tone chime (C5→E5, 400ms)
  generateTwoToneWav(path.join(AUDIO_DIR, 'success.wav'), 523, 659, 400, 0.35);
  // Warning: lower alert tone (A3, 600ms)
  generateWav(path.join(AUDIO_DIR, 'warning.wav'), 220, 600, 0.4);

  // 3. Icon
  console.log('\n🎨 App Icon:');
  ensureDir(path.dirname(ICON_PATH));
  generateIco(ICON_PATH);

  console.log('\n✅ All assets ready!\n');
}

main().catch(err => {
  console.error('❌ Asset setup failed:', err.message);
  process.exit(1);
});
