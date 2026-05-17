/**
 * Generate Excel test fixtures for manifest import testing
 * Run: node tests/fixtures/_generate.js
 */

const XLSX = require('xlsx');
const path = require('path');

// Helper: Create a workbook with specific rows
function createFixture(filename, rows, sheetName = 'Passengers') {
  const headers = [
    'رقم الجواز',     // passport_number (Arabic)
    'الاسم',           // name (Arabic)
    'النوع',           // gender (Arabic)
    'الجنسية',         // nationality (Arabic)
    'تاريخ الميلاد',   // date_of_birth (Arabic)
    'السفينة',         // vessel (Arabic, optional)
    'المقعد'           // seat (Arabic, optional)
  ];

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths for readability
  ws['!cols'] = [
    { wch: 15 }, // passport_number
    { wch: 25 }, // name
    { wch: 10 }, // gender
    { wch: 10 }, // nationality
    { wch: 15 }, // date_of_birth
    { wch: 15 }, // vessel
    { wch: 10 }  // seat
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Add Instructions sheet for completeness
  const instructionsData = [
    ['Field', 'Format', 'Arabic Name', 'Notes'],
    ['Passport Number', 'Text, ≥5 chars', 'رقم الجواز', 'Required'],
    ['Full Name', 'Text', 'الاسم', 'Required'],
    ['Gender', 'M/F/Male/Female/ذكر/أنثى', 'النوع', 'Required'],
    ['Nationality', 'ISO 3166-1 alpha-3 (e.g., EGY)', 'الجنسية', 'Required, 3-letter code'],
    ['Date of Birth', 'YYYY-MM-DD or Excel date', 'تاريخ الميلاد', 'Required, must be in past'],
    ['Vessel', 'Text', 'السفينة', 'Optional'],
    ['Seat', 'Text', 'المقعد', 'Optional'],
    ['', '', '', ''],
    ['Sample Row:', '', '', ''],
    ['EG123456', 'محمد علي أحمد', 'M', 'EGY', '1990-05-15', 'MS Aida', 'A12']
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 50 }];

  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  const filePath = path.join(__dirname, filename);
  XLSX.write(wb, { bookType: 'xlsx', type: 'file', file: filePath });
  console.log(`✓ Generated: ${filePath}`);
}

// Fixture 1: manifest-10.xlsx (10 valid rows)
const validRows = [
  ['EG001', 'أحمد محمد علي', 'M', 'EGY', '1990-05-15', 'MS Aida', 'A01'],
  ['EG002', 'فاطمة عبدالله حسن', 'F', 'EGY', '1985-03-22', 'MS Aida', 'A02'],
  ['SA001', 'محمود خالد الدعيع', 'M', 'SAU', '1988-11-30', 'MS Aida', 'B01'],
  ['AE001', 'نورا محمد الكتبي', 'F', 'ARE', '1992-07-14', '', ''],
  ['KW001', 'عبدالرحمن يوسف السهلي', 'M', 'KWT', '1987-01-09', 'MS Aida', 'C05'],
  ['QA001', 'ليلى أحمد المهيري', 'F', 'QAT', '1991-09-25', '', ''],
  ['OM001', 'حسن سالم العوفي', 'M', 'OMN', '1986-04-12', 'MS Aida', 'D10'],
  ['JO001', 'سارة محمود الزعبي', 'F', 'JOR', '1993-02-28', '', 'E03'],
  ['LB001', 'علي حسين الرفاعي', 'M', 'LBN', '1989-06-19', 'MS Aida', ''],
  ['SY001', 'هناء إبراهيم الأسد', 'F', 'SYR', '1994-12-03', '', 'F12']
];

createFixture('manifest-10.xlsx', validRows);

// Fixture 2: manifest-with-errors.xlsx (8 rows with specific error cases)
const errorRows = [
  // Row 1: Missing passport number (ERROR)
  ['', 'محمد علي أحمد', 'M', 'EGY', '1990-05-15', '', ''],
  // Row 2: Valid
  ['EG010', 'فاطمة عبدالله حسن', 'F', 'EGY', '1985-03-22', '', ''],
  // Row 3: Bad nationality code - "XXX" is not a valid ISO code (ERROR)
  ['EG011', 'أحمد محمود الحسن', 'M', 'XXX', '1988-11-30', '', ''],
  // Row 4: Future date of birth (ERROR - must be in past)
  ['EG012', 'نورا محمد علي', 'F', 'EGY', '2025-07-14', '', ''],
  // Row 5: Valid
  ['EG013', 'عبدالرحمن يوسف', 'M', 'SAU', '1987-01-09', 'MS Aida', 'C05'],
  // Row 6: Valid
  ['EG014', 'ليلى أحمد محمود', 'F', 'ARE', '1991-09-25', '', ''],
  // Row 7: Valid
  ['EG015', 'حسن سالم', 'M', 'OMN', '1986-04-12', 'MS Aida', 'D10'],
  // Row 8: Missing passport number (ERROR)
  ['', 'سارة محمود', 'F', 'JOR', '1993-02-28', '', 'E03']
];

createFixture('manifest-with-errors.xlsx', errorRows);

// Fixture 3: manifest-1000.xlsx (1000 valid rows)
const largeRows = [];
for (let i = 1; i <= 1000; i++) {
  // Pad with leading zeros (e.g. EG0001)
  const id = String(i).padStart(4, '0');
  largeRows.push([
    `EG${id}`, 
    `راكب تجريبي ${i}`, 
    i % 2 === 0 ? 'F' : 'M', 
    'EGY', 
    '1980-01-01', 
    'MS LoadTest', 
    `S${id}`
  ]);
}
createFixture('manifest-1000.xlsx', largeRows);

console.log('\n✓ Test fixtures generated successfully!');
console.log('  - manifest-10.xlsx: 10 valid rows');
console.log('  - manifest-with-errors.xlsx: 8 rows (2 missing passport, 1 bad nationality, 1 future DoB, 4 valid)');
console.log('  - manifest-1000.xlsx: 1000 valid rows');
