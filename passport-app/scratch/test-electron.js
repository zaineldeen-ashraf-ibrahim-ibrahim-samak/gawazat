const { app } = require('electron');
app.on('ready', () => {
  try {
    const pdfmake = require('pdfmake');
    console.log('pdfmake type:', typeof pdfmake);
    pdfmake.setFonts({ Roboto: { normal: 'Helvetica' } });
    const doc = pdfmake.createPdf({ content: 'test' });
    console.log('doc type:', typeof doc);
  } catch (err) {
    console.error('ERROR IN ELECTRON:', err);
  }
  app.quit();
});
