#!/usr/bin/env node

/**
 * Read MRZ records from a .txt file and write them to an .xlsx workbook.
 *
 * Usage:
 *   node scripts/mrz-to-excel.js <input.txt> [output.xlsx]
 *
 * Input format:
 *   - Plain text containing one or more MRZ records (TD1 = 3 lines × 30,
 *     TD3 = 2 lines × 44).
 *   - Records are separated by one or more blank lines.
 *   - Stray characters such as a leading `"` from scanner output are tolerated;
 *     parseMrz strips anything that is not [A-Z0-9<].
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { parseMrz } = require('../src/shared/mrz');

const HEADERS = [
  'Type',
  'Document Number',
  'Surname',
  'Given Names',
  'Nationality',
  'Date of Birth',
  'Sex',
  'Expiry Date',
  'Check Digits Valid',
];

function splitRecords(text) {
  const records = [];
  let current = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '') {
      if (current.length > 0) {
        records.push(current);
        current = [];
      }
    } else {
      current.push(rawLine);
    }
  }
  if (current.length > 0) records.push(current);
  return records;
}

function recordToRow(lines) {
  const result = parseMrz(lines.join('\n'));
  return [
    result.type,
    result.document_number,
    result.surname,
    result.given_names,
    result.nationality,
    result.date_of_birth,
    result.sex,
    result.expiry_date,
    result.check_digits_valid,
  ];
}

function main() {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg) {
    console.error('Usage: node scripts/mrz-to-excel.js <input.txt> [output.xlsx]');
    process.exit(1);
  }

  const inputPath = path.resolve(inputArg);
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const outputPath = outputArg
    ? path.resolve(outputArg)
    : inputPath.replace(/\.txt$/i, '') + '.xlsx';

  const text = fs.readFileSync(inputPath, 'utf8');
  const records = splitRecords(text);
  if (records.length === 0) {
    console.error('No MRZ records found in input.');
    process.exit(1);
  }

  const rows = [HEADERS, ...records.map(recordToRow)];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'MRZ');
  XLSX.writeFile(wb, outputPath);

  const parsedOk = rows.slice(1).filter((r) => r[0] !== 'UNKNOWN').length;
  console.log(`Wrote ${rows.length - 1} record(s) (${parsedOk} parsed) -> ${outputPath}`);
}

main();
