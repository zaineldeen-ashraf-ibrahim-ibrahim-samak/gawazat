/**
 * Report PDF Service
 * Generates Arabic RTL PDF reports using pdfmake.
 *
 * Arabic pipeline:
 *   1. arabic-reshaper  — connects letters (ا ل ن → الن)
 *   2. pdfmake rtl:true — handles paragraph/column direction
 *
 * bidi-js character reordering is intentionally NOT used here.
 * pdfmake's rtl flag manages visual order at the layout level;
 * applying getReorderedString on top of reshaped text reverses
 * individual characters and produces garbage output.
 */

const pdfmake = require('pdfmake');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');
const ArabicReshaper = require('arabic-reshaper');

const FONTS_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'assets', 'fonts');

const fonts = {
  Amiri: {
    normal:      path.join(FONTS_DIR, 'Amiri-Regular.ttf'),
    bold:        path.join(FONTS_DIR, 'Amiri-Bold.ttf'),
    italics:     path.join(FONTS_DIR, 'Amiri-Regular.ttf'), // no italic variant — fallback to regular
    bolditalics: path.join(FONTS_DIR, 'Amiri-Bold.ttf'),
  },
};

let fontsReady = false;

function initFonts() {
  if (fontsReady) return;
  if (!fs.existsSync(fonts.Amiri.normal)) {
    logger.warn(`Font missing: ${fonts.Amiri.normal} — run 'npm run setup-assets'`);
  }
  if (!fs.existsSync(fonts.Amiri.bold)) {
    fonts.Amiri.bold = fonts.Amiri.normal; // fallback
  }
  pdfmake.setFonts(fonts);
  if (typeof pdfmake.setUrlAccessPolicy === 'function') {
    pdfmake.setUrlAccessPolicy(() => false); // block all external URL fetches
  }
  fontsReady = true;
}

/**
 * Reshape Arabic text into Presentation Form codepoints (FE70–FEFF).
 * This bypasses pdfmake's GPOS mark-attachment shaper, which crashes on null
 * anchors in the Amiri font when raw Unicode Arabic (0600–06FF) is passed.
 * pdfmake rtl:true still handles layout direction; reshaping handles letter connection.
 */
function ar(str) {
  if (!str) return '';
  // Use raw Unicode with RTL mark. Let pdfmake 0.3.x's internal shaper handle connectivity.
  return `\u200F${str}`;
}

/** Formatted date string in English locale */
function dateEn(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

const KIND_TITLES = {
  full:     'Comprehensive Passenger Report',
  entered:  'Entered Passengers List',
  pending:  'Waiting List',
  warnings: 'Warnings and Duplicate Entries Report',
  new:      'New Passengers List (Added at Gate)',
  pendingApproval: 'Pending Approval List',
};

const STATUS_LABELS = {
  entered:  'Entered',
  pending:  'Waiting',
  warning:  'Warning',
  rejected: 'Rejected',
};

function passengerStatus(p) {
  if (p.is_duplicate) return STATUS_LABELS.warning;
  if (p.is_entered)   return STATUS_LABELS.entered;
  return STATUS_LABELS.pending;
}

/**
 * Generate a PDF report.
 * @param {'full'|'entered'|'pending'|'warnings'} kind
 * @param {{ voyage: Object, passengers: Object[] }} data
 * @param {string} savePath
 */
async function generateReport(kind, data, savePath) {
  initFonts();

  const { voyage, passengers } = data;
  const title    = KIND_TITLES[kind] ?? KIND_TITLES.full;
  const shipName = voyage.ship_name || '---';
  const today    = dateEn();
  const total    = passengers.length;

  // Table header row (LTR: leftmost column first)
  const headerRow = [
    '#',
    'Passport Number',
    'Name',
    'Gender',
    'DOB',
    'Nationality',
    'Type',
    'Status',
  ].map(text => ({
    text,
    style: 'tableHeader',
    alignment: 'center',
  }));

  const dataRows = passengers.map((p, i) => {
    let statusTxt = passengerStatus(p);
    if (p.missingOptionalFields?.length > 0) {
      statusTxt += ` (Missing: ${p.missingOptionalFields.join(', ')})`;
    }
    return [
      { text: String(i + 1), alignment: 'center', style: 'tableCell', color: '#94a3b8' },
      { text: p.passport_number ?? '', alignment: 'center', style: 'tableCell', noWrap: true },
      { text: p.name            ?? '', alignment: 'left',   style: 'tableCell' },
      { text: p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : (p.gender ?? ''), alignment: 'center', style: 'tableCell' },
      { text: p.date_of_birth   ?? '', alignment: 'center', style: 'tableCell' },
      { text: p.nationality     ?? '', alignment: 'left',   style: 'tableCell' },
      {
        text: p.source === 'added-at-gate' ? 'New' : p.source === 'manual' ? 'Manual' : 'Original',
        alignment: 'center',
        style: 'tableCell',
        color: p.source === 'added-at-gate' ? '#d97706' : p.source === 'manual' ? '#0891b2' : '#6b7280',
      },
      { text: statusTxt, alignment: 'center', style: 'tableCell' },
    ];
  });

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [40, 50, 40, 40],
    rtl: false,

    content: [
      // App name
      {
        text: config.appName,
        style: 'appTitle',
        alignment: 'center',
        margin: [0, 0, 0, 4],
      },
      // Report title
      {
        text: title,
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 12],
      },
      // Meta info
      {
        columns: [
          { text: `Date: ${today}`,        style: 'meta', alignment: 'left' },
          { text: `Total: ${total} passengers`,   style: 'meta', alignment: 'center' },
          { text: `Ship: ${shipName}`,      style: 'meta', alignment: 'right' },
        ],
        margin: [0, 0, 0, 16],
      },
      // Passenger table (or empty notice)
      ...(dataRows.length === 0 ? [{
        text: 'No data available to display',
        alignment: 'center',
        style: 'meta',
        color: '#9ca3af',
        margin: [0, 20, 0, 20],
      }] : [{
        table: {
          headerRows: 1,
          widths: [20, 75, 100, 35, 55, 45, 38, 38],
          body: [headerRow, ...dataRows],
        },
        layout: {
          hLineWidth: (i) => (i === 0 || i === 1) ? 1.5 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#334155',
          vLineColor: () => '#cbd5e1',
          paddingLeft:   () => 5,
          paddingRight:  () => 5,
          paddingTop:    (i) => i === 0 ? 6 : 4,
          paddingBottom: (i) => i === 0 ? 6 : 4,
          fillColor: (rowIndex) => {
            if (rowIndex === 0) return '#1e3a5f';
            return rowIndex % 2 === 0 ? '#f8fafc' : null;
          },
        },
      }]),
      // Footer note
      {
        text: `* This report was generated automatically by ${config.appName}`,
        style: 'footerNote',
        margin: [0, 20, 0, 0],
        alignment: 'left',
      },
    ],

    defaultStyle: {
      font: 'Amiri',
      fontSize: 10,
      alignment: 'left',
    },

    styles: {
      appTitle: {
        font: 'Amiri',
        fontSize: 14,
        bold: true,
        color: '#1e3a5f',
      },
      header: {
        font: 'Amiri',
        fontSize: 18,
        bold: true,
        color: '#0f2744',
      },
      meta: {
        font: 'Amiri',
        fontSize: 11,
        color: '#374151',
      },
      tableHeader: {
        font: 'Amiri',
        fontSize: 10,
        bold: true,
        color: '#ffffff',
      },
      tableCell: {
        font: 'Amiri',
        fontSize: 9,
        color: '#1f2937',
      },
      footerNote: {
        font: 'Amiri',
        fontSize: 8,
        color: '#9ca3af',
      },
    },
  };

  try {
    const pdfDoc = pdfmake.createPdf(docDefinition);
    await pdfDoc.write(savePath);
    logger.info(`PDF written: ${savePath} (${total} passengers, kind=${kind})`);
    return { ok: true };
  } catch (err) {
    logger.error(`PDF generation failed: ${err.message}`);
    throw err;
  }
}

module.exports = { generateReport };
