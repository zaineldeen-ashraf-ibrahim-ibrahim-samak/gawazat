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
  fontsReady = true;
}

/**
 * Reshape Arabic text into Presentation Form codepoints (FE70–FEFF).
 * This bypasses pdfmake's GPOS mark-attachment shaper, which crashes on null
 * anchors in the Amiri font when raw Unicode Arabic (0600–06FF) is passed.
 * pdfmake rtl:true still handles layout direction; reshaping handles letter connection.
 */
function ar(str) {
  return ArabicReshaper.convertArabic(String(str ?? ''));
}

/** Formatted date string in Arabic locale */
function dateAr(date = new Date()) {
  return date.toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

const KIND_TITLES = {
  full:     'تقرير شامل للمسافرين',
  entered:  'قائمة المسافرين المُدخَلين',
  pending:  'قائمة المسافرين في الانتظار',
  warnings: 'تقرير التحذيرات والإدخالات المكررة',
};

const STATUS_LABELS = {
  entered:  'تم الدخول',
  pending:  'في الانتظار',
  warning:  'تحذير',
  rejected: 'مرفوض',
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
  const today    = dateAr();
  const total    = passengers.length;

  // Table header row (RTL: rightmost column first in the array = rightmost on page)
  const headerRow = [
    ar('الحالة'),
    ar('الجنسية'),
    ar('تاريخ الميلاد'),
    ar('الجنس'),
    ar('الاسم'),
    ar('رقم الجواز'),
  ].map(text => ({
    text,
    style: 'tableHeader',
    alignment: 'center',
  }));

  const dataRows = passengers.map((p, i) => [
    { text: ar(passengerStatus(p)), alignment: 'center', style: 'tableCell' },
    { text: ar(p.nationality  ?? ''), alignment: 'right',  style: 'tableCell' },
    { text: p.date_of_birth   ?? '',  alignment: 'center', style: 'tableCell' },
    { text: ar(p.gender === 'M' ? 'ذكر' : p.gender === 'F' ? 'أنثى' : (p.gender ?? '')), alignment: 'center', style: 'tableCell' },
    { text: ar(p.name         ?? ''), alignment: 'right',  style: 'tableCell' },
    { text: p.passport_number ?? '',  alignment: 'center', style: 'tableCell' },
  ]);

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [30, 50, 30, 40],
    rtl: true,

    content: [
      // App name
      {
        text: ar(config.appName),
        style: 'appTitle',
        alignment: 'center',
        margin: [0, 0, 0, 4],
      },
      // Report title
      {
        text: ar(title),
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 12],
      },
      // Meta info
      {
        columns: [
          { text: ar(`التاريخ: ${today}`),        style: 'meta', alignment: 'right' },
          { text: ar(`إجمالي: ${total} مسافر`),   style: 'meta', alignment: 'center' },
          { text: ar(`السفينة: ${shipName}`),      style: 'meta', alignment: 'left' },
        ],
        margin: [0, 0, 0, 16],
      },
      // Passenger table
      {
        table: {
          headerRows: 1,
          widths: [55, 60, 60, 30, '*', 70],
          body: [headerRow, ...dataRows],
        },
        layout: {
          hLineWidth: (i) => (i === 0 || i === 1) ? 1.5 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#334155',
          vLineColor: () => '#cbd5e1',
          fillColor: (rowIndex) => {
            if (rowIndex === 0) return '#1e3a5f';
            return rowIndex % 2 === 0 ? '#f8fafc' : null;
          },
        },
      },
      // Footer note
      {
        text: ar(`* تم إنشاء هذا التقرير تلقائياً بواسطة ${config.appName}`),
        style: 'footerNote',
        margin: [0, 20, 0, 0],
        alignment: 'right',
      },
    ],

    defaultStyle: {
      font: 'Amiri',
      fontSize: 10,
      alignment: 'right',
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
        fillColor: '#1e3a5f',
        margin: [2, 4, 2, 4],
      },
      tableCell: {
        font: 'Amiri',
        fontSize: 9,
        margin: [2, 3, 2, 3],
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
