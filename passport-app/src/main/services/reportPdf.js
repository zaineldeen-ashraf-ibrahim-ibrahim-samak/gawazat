/**
 * Report PDF Service
 * Generates Arabic RTL PDF reports using pdfmake.
 */

const PdfPrinter = require('pdfmake/js/printer').default;
const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');

// Font configuration
// Note: Amiri-Regular.ttf must be present in the assets/fonts directory
const fonts = {
  Amiri: {
    normal: path.join(__dirname, '..', '..', '..', 'renderer', 'assets', 'fonts', 'Amiri-Regular.ttf'),
    bold: path.join(__dirname, '..', '..', '..', 'renderer', 'assets', 'fonts', 'Amiri-Bold.ttf'),
  }
};

let printer = null;

function getPrinter() {
  if (!printer) {
    // Verify font files exist before creating printer
    const normalFont = fonts.Amiri.normal;
    const boldFont = fonts.Amiri.bold;
    if (!fs.existsSync(normalFont)) {
      logger.warn(`Font not found: ${normalFont} — run 'npm run setup-assets' to download`);
    }
    if (!fs.existsSync(boldFont)) {
      // Fallback: use normal as bold if bold isn't available
      fonts.Amiri.bold = fonts.Amiri.normal;
    }
    printer = new PdfPrinter(fonts);
  }
  return printer;
}

/**
 * Generate a PDF report
 * @param {string} kind - 'full' | 'entered' | 'pending' | 'warnings'
 * @param {Object} data - Voyage and Passenger data
 * @param {string} savePath - Where to save the PDF
 */
async function generateReport(kind, data, savePath) {
  try {
    const { voyage, passengers, stats } = data;
    
    const docDefinition = {
      content: [
        { text: `تقرير ${config.appName}`, style: 'header' },
        { text: `سفينة: ${voyage.ship_name || '---'}`, style: 'subheader' },
        { text: `التاريخ: ${new Date().toLocaleDateString('ar-EG')}`, style: 'subheader' },
        { text: '\n' },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*'],
            body: [
              ['الحالة', 'الجنسية', 'الاسم', 'رقم الجواز'],
              ...passengers.map(p => [
                p.is_entered ? 'تم الدخول' : 'في الانتظار',
                p.nationality,
                p.name,
                p.passport_number
              ])
            ]
          },
          layout: 'lightHorizontalLines'
        }
      ],
      defaultStyle: {
        font: 'Amiri',
        alignment: 'right'
      },
      styles: {
        header: {
          fontSize: 22,
          bold: true,
          margin: [0, 0, 0, 10]
        },
        subheader: {
          fontSize: 16,
          bold: true,
          margin: [0, 10, 0, 5]
        }
      },
      rtl: true
    };

    const pdfDoc = getPrinter().createPdfKitDocument(docDefinition);
    pdfDoc.pipe(fs.createWriteStream(savePath));
    pdfDoc.end();

    return new Promise((resolve, reject) => {
      pdfDoc.on('end', () => resolve({ ok: true }));
      pdfDoc.on('error', (err) => reject(err));
    });
  } catch (err) {
    logger.error(`PDF Generation failed: ${err.message}`);
    throw err;
  }
}

module.exports = { generateReport };
