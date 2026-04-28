const pdfmake = require('pdfmake');
const path = require('path');
const ArabicReshaper = require('arabic-reshaper');

const fonts = {
  Amiri: {
    normal: path.join(__dirname, '..', 'renderer', 'assets', 'fonts', 'Amiri-Regular.ttf')
  }
};
pdfmake.setFonts(fonts);

const rawText = 'سلام عليكم';
const reshapedText = ArabicReshaper.convertArabic(rawText);

console.log('Raw:', Buffer.from(rawText).toString('hex'));
console.log('Reshaped:', Buffer.from(reshapedText).toString('hex'));

const docDefinition = {
  content: [
    { text: rawText, style: 'normal' },
    { text: reshapedText, style: 'normal' }
  ],
  defaultStyle: { font: 'Amiri', alignment: 'right' },
  styles: { normal: { fontSize: 24 } }
};

const pdfDoc = pdfmake.createPdf(docDefinition);
pdfDoc.write(path.join(__dirname, 'test-rtl.pdf')).then(() => {
  console.log('Created test-rtl.pdf');
});
