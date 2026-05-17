const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Random names and nationalities for variety
const firstNames = ['Ahmed', 'Mohamed', 'John', 'Sarah', 'Fatima', 'Emma', 'Ali', 'Omar', 'Lucas', 'Mia'];
const lastNames = ['Smith', 'Ali', 'Hassan', 'Brown', 'Garcia', 'Lee', 'Abbas', 'Kim', 'Johnson', 'Martin'];
const nationalities = ['Egypt', 'USA', 'Germany', 'Japan', 'Brazil', 'Monaco', 'Tanzania', 'United Kingdom', 'Canada', 'France', 'مصر', 'السعودية', 'الإمارات'];
const genders = ['M', 'F'];

const rows = [];
// Add header
rows.push(['Passport Number', 'Name', 'Nationality', 'Gender', 'Date of Birth']);

for (let i = 1; i <= 1000; i++) {
  const passport = `A${Math.floor(10000000 + Math.random() * 90000000)}`;
  const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const name = `${fName} ${lName}`;
  const nationality = nationalities[Math.floor(Math.random() * nationalities.length)];
  const gender = genders[Math.floor(Math.random() * genders.length)];
  
  // Random DOB between 1950 and 2010
  const year = 1950 + Math.floor(Math.random() * 60);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  const dob = `${year}-${month}-${day}`;

  rows.push([passport, name, nationality, gender, dob]);
}

const wb = xlsx.utils.book_new();
const ws = xlsx.utils.aoa_to_sheet(rows);

// Adjust column widths
ws['!cols'] = [{wch: 15}, {wch: 25}, {wch: 15}, {wch: 8}, {wch: 12}];

xlsx.utils.book_append_sheet(wb, ws, 'Passengers');

const outDir = path.join(__dirname, '../../cases');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, 'mock-1000.xlsx');
xlsx.writeFile(wb, outPath);

console.log(`Generated 1000 mock passengers at ${outPath}`);
