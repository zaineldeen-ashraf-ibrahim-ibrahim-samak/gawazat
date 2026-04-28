const { app } = require('electron');
app.on('ready', () => {
  const resolved = require.resolve('pdfmake');
  console.log('Resolved pdfmake to:', resolved);
  app.quit();
});
