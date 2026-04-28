const { app } = require('electron');
const path = require('path');
const reportPdf = require('../src/main/services/reportPdf');

app.on('ready', async () => {
  const dummyData = {
    voyage: { ship_name: 'Test Ship' },
    passengers: [],
    stats: { total: 0, entered: 0, pending: 0, warnings: 0 }
  };
  try {
    const savePath = path.join(__dirname, 'test2.pdf');
    await reportPdf.generateReport('full', dummyData, savePath);
    console.log('PDF generated successfully!');
  } catch (err) {
    console.error('ERROR IN ELECTRON:', err);
  }
  app.quit();
});
