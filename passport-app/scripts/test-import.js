const { parseFile } = require('../src/main/services/manifestImport.js');
const { DEFAULT_FIELD_REQUIREMENTS } = require('../src/shared/fieldRequirements.js');
const path = require('path');

async function test() {
  const filePath = path.join(__dirname, '../../cases/mock-1000.xlsx');
  console.log(`Testing import of: ${filePath}`);
  console.time('parseFile');
  const result = await parseFile(filePath, DEFAULT_FIELD_REQUIREMENTS);
  console.timeEnd('parseFile');
  
  console.log(`Parsed ${result.rows.length} rows.`);
  if (result.errors.length > 0) {
    console.error(`Found ${result.errors.length} errors:`, result.errors.slice(0, 10));
  } else {
    console.log('No errors! Import completely successful.');
  }
}

test();
