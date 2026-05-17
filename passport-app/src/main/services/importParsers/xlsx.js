const XLSX = require('xlsx');

// Header aliases. Each value is matched against the *normalised* header text
// (lowercased, whitespace collapsed, punctuation/newlines stripped).
//
// Some real-world workbooks (cruise-line passenger manifests) split the
// passenger name across Last/First columns and provide both a full
// nationality string and an ISO-3 code; the parser handles both.
const HEADER_ALIASES = {
  passport_number: [
    'passport number', 'passport_number', 'passport', 'رقم الجواز', 'رقم الوثيقة',
    'document number', 'doc number', 'document no', 'passport no', 'pp number'
  ],
  name: [
    'name', 'full name', 'passenger name', 'الاسم', 'اسم المسافر'
  ],
  name_last: [
    'last name', 'surname', 'family name', 'الاسم الاخير', 'اللقب'
  ],
  name_first: [
    'first name', 'given name', 'given names', 'الاسم الاول'
  ],
  gender: [
    'gender', 'sex', 'الجنس', 'النوع'
  ],
  // Prefer ISO-3 column when present; otherwise fall back to the full
  // nationality string and let convertCountryToIso3 / AI normalize finish it.
  nationality_iso3: [
    'pp iso3', 'iso3', 'iso 3', 'iso code', 'iso3 code', 'nationality code'
  ],
  nationality: [
    'nationality', 'الجنسية', 'passport nationality', 'birth nationality', 'country'
  ],
  date_of_birth: [
    'date of birth', 'date_of_birth', 'dob', 'تاريخ الميلاد', 'الميلاد',
    'birth date', 'birthdate', 'date birth'
  ],
  vessel: [
    'vessel', 'ship', 'الباخرة', 'السفينة'
  ],
  seat: [
    'seat', 'cabin', 'suite number', 'suite', 'رقم المقعد', 'المقعد', 'الكابينة'
  ]
};

const countries = require('i18n-iso-countries');
countries.registerLocale(require('i18n-iso-countries/langs/en.json'));
countries.registerLocale(require('i18n-iso-countries/langs/ar.json'));

// Common operator-typed truncations and informal 3-letter codes that are NOT
// ISO-3166-1 alpha-3. Real-world manifests routinely contain these. Mapping
// them upfront means downstream validation doesn't reject otherwise-valid
// passenger rows. For genuinely ambiguous truncations ("UNI" could be UK or
// USA), pick the most common interpretation seen in cruise-line lists.
const TRUNCATION_TO_ISO3 = {
  'UNI': 'USA',   // "United (States)" — most-frequent in cruise manifests
  'UK':  'GBR',
  'UAE': 'ARE',
  'GRE': 'GRC',   // Greece
  'IRE': 'IRL',   // Ireland
  'NEP': 'NPL',   // Nepal
  'GUA': 'GTM',   // Guatemala
  'TAN': 'TZA',   // Tanzania
  'MON': 'MCO',   // Monaco (vs. Mongolia/Montenegro — Monaco dominates cruise lists)
  'NET': 'NLD',   // Netherlands
  'POR': 'PRT',   // Portugal
  'SWI': 'CHE',   // Switzerland
  'SPA': 'ESP',   // Spain
  'GER': 'DEU',   // Germany
  'ITA': 'ITA',
  'PHI': 'PHL',   // Philippines
  'COS': 'CRI',   // Costa Rica
  'DOM': 'DOM',
  'CZE': 'CZE',
  'SLO': 'SVN',   // Slovenia
  'SVK': 'SVK',
  'RUS': 'RUS'
};

/**
 * Convert a free-form nationality string to ISO-3, when possible. Accepts
 * already-ISO codes (returns them upper-cased), full country names, or
 * common abbreviations. Returns the original value when no match is found —
 * downstream AI/local normalize gets a chance to resolve unknowns.
 */
function convertCountryToIso3(value) {
  if (!value) return value;
  const s = String(value).trim();
  if (!s) return s;

  // 1. Try automatic library translation (English or Arabic)
  let iso = countries.getAlpha3Code(s, 'en');
  if (iso) return iso;
  
  iso = countries.getAlpha3Code(s, 'ar');
  if (iso) return iso;

  // 2. Try common edge cases / truncations
  const upper = s.toUpperCase();
  if (TRUNCATION_TO_ISO3[upper]) return TRUNCATION_TO_ISO3[upper];
  
  // 3. Fallback: return if already looks like ISO3
  if (upper.length === 3 && /^[A-Z]{3}$/.test(upper)) return upper;
  
  return s;
}

function normalizeHeader(str) {
  if (!str || typeof str !== 'string') return '';
  // Lower-case, collapse newlines / whitespace / punctuation so embedded
  // \r\n in Excel headers ("Passport \r\nNumber") still matches "passport number".
  return String(str)
    .replace(/[\r\n]+/g, ' ')
    .toLowerCase()
    .replace(/[._*\-\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Maps input headers to canonical schema keys.
 * @param {Array} headers - Raw header row from Excel
 * @returns {Object} Map of canonical_key -> index
 */
function mapHeaders(headers) {
  const mapping = {};
  const normalizedHeaders = (headers || []).map(normalizeHeader);

  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const target = normalizeHeader(alias);
      const idx = normalizedHeaders.findIndex(h => h === target);
      if (idx !== -1) {
        mapping[canonical] = idx;
        break;
      }
    }
  }

  return mapping;
}

/**
 * Score how plausibly `headerMap` represents a real passenger header row.
 * Used to auto-detect the header line when the workbook has decorative
 * title rows above it (cruise-line "ARRIVAL PAX LIST" / "EMBARKING" reports).
 */
function scoreHeaderMap(headerMap) {
  let score = 0;
  if ('passport_number' in headerMap) score += 3;
  if ('name' in headerMap || ('name_last' in headerMap && 'name_first' in headerMap)) score += 3;
  if ('date_of_birth' in headerMap) score += 2;
  if ('nationality' in headerMap || 'nationality_iso3' in headerMap) score += 2;
  if ('gender' in headerMap) score += 1;
  return score;
}

/**
 * Scan the first N rows for the most plausible header row. Skips banner /
 * title rows like "CRYSTAL SERENITY" / "EMBARKING PAX LIST" / blank rows.
 * Returns { headerRowIndex, headerMap }.
 */
function findHeaderRow(data, maxScan = 15) {
  let best = { headerRowIndex: 0, headerMap: {}, score: -1 };
  const upper = Math.min(maxScan, data.length);
  for (let i = 0; i < upper; i++) {
    const row = data[i];
    if (!row || row.every(cell => cell === '' || cell == null)) continue;
    const map = mapHeaders(row);
    const score = scoreHeaderMap(map);
    if (score > best.score) {
      best = { headerRowIndex: i, headerMap: map, score };
    }
  }
  return best;
}

function listSheets(filePath) {
  const workbook = XLSX.readFile(filePath, { bookSheets: true });
  return Array.isArray(workbook.SheetNames) ? workbook.SheetNames.slice() : [];
}

/**
 * Inspect each sheet in a workbook and tag whether it looks like passenger
 * data. Used by the renderer to filter / down-rank sheets like
 * "NAT BREAKDOWN" / "SUMMARY" that don't have a passenger header.
 *
 * @returns {Array<{name:string, isPassengerSheet:boolean, score:number, rowCount:number}>}
 */
function describeSheets(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const out = [];
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const { score } = findHeaderRow(data);
    out.push({
      name,
      score,
      rowCount: data.length,
      // 5+ matches the threshold used by parseXlsx itself (passport + name + DOB
      // + nationality at minimum). Sheets named like "BREAKDOWN"/"SUMMARY"
      // typically never reach that.
      isPassengerSheet: score >= 5 && !/\b(BREAKDOWN|SUMMARY|TOTAL|NATIONALITY)\b/i.test(name)
    });
  }
  return out;
}

/**
 * Parse an Excel file (.xlsx, .xls) and return raw rows.
 * Tolerates:
 *   - decorative banner rows above the header,
 *   - headers containing embedded \r\n,
 *   - separate Last/First name columns (joined into `name`),
 *   - nationality given as a long country name (converted to ISO-3 when possible).
 *
 * @param {string} filePath
 * @param {string} [sheetName] - optional sheet; defaults to the first
 * @returns {Array<Object>}
 */
function parseXlsx(filePath, sheetName) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });

  // Pick the best sheet. Order of preference:
  //   1. The sheet the operator explicitly chose, if it exists AND scores as
  //      passenger data.
  //   2. The first sheet in the workbook that scores as passenger data.
  //   3. The first sheet (legacy fallback — will likely throw below).
  let chosen = null;
  const candidates = workbook.SheetNames.filter(n =>
    !/\b(BREAKDOWN|SUMMARY|TOTAL|NATIONALITY)\b/i.test(n)
  );
  const orderedTry = [];
  if (sheetName && workbook.SheetNames.includes(sheetName)) orderedTry.push(sheetName);
  for (const n of candidates) if (!orderedTry.includes(n)) orderedTry.push(n);
  for (const n of workbook.SheetNames) if (!orderedTry.includes(n)) orderedTry.push(n);

  let data = null;
  let chosenInfo = null;
  for (const n of orderedTry) {
    const ws = workbook.Sheets[n];
    const probeData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (probeData.length < 2) continue;
    const info = findHeaderRow(probeData);
    if (info.score >= 5 && 'passport_number' in info.headerMap) {
      chosen = n;
      data = probeData;
      chosenInfo = info;
      break;
    }
  }
  if (!chosen) {
    // Last resort — use the requested sheet (or the first) so the existing
    // error-reporting path runs and the user gets a clear "missing columns"
    // message instead of silent success.
    chosen = sheetName && workbook.SheetNames.includes(sheetName)
      ? sheetName
      : workbook.SheetNames[0];
    data = XLSX.utils.sheet_to_json(workbook.Sheets[chosen], { header: 1, defval: '' });
    chosenInfo = findHeaderRow(data || []);
  }

  if (!data || data.length < 2) {
    throw new Error('File must contain at least one data row (plus header)');
  }

  const { headerRowIndex, headerMap, score } = chosenInfo;

  // A good passenger header should produce at minimum a passport number
  // column and *some* name signal. Anything lower is almost certainly a
  // summary / breakdown sheet rather than a passenger list.
  if (score < 5 || !('passport_number' in headerMap)) {
    const missing = ['passport_number', 'name (or last+first)', 'date_of_birth', 'nationality']
      .filter(key => {
        if (key === 'passport_number') return !('passport_number' in headerMap);
        if (key === 'name (or last+first)') return !('name' in headerMap) && !('name_last' in headerMap && 'name_first' in headerMap);
        if (key === 'nationality') return !('nationality' in headerMap) && !('nationality_iso3' in headerMap);
        return !(key in headerMap);
      });
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }

  const rows = [];
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every(cell => cell === '' || cell == null)) continue;

    const mappedRow = {};
    for (const [canonical, idx] of Object.entries(headerMap)) {
      mappedRow[canonical] = row[idx];
    }

    // Compose `name` from Last + First when the workbook splits them.
    if (!mappedRow.name) {
      const last = mappedRow.name_last ? String(mappedRow.name_last).trim() : '';
      const first = mappedRow.name_first ? String(mappedRow.name_first).trim() : '';
      const composed = [last, first].filter(Boolean).join(' ');
      if (composed) mappedRow.name = composed;
    }

    // Resolve nationality: prefer explicit ISO-3 column, otherwise try to
    // convert the country name. Leave the original as a hint for AI fallback.
    const iso3 = mappedRow.nationality_iso3 ? convertCountryToIso3(mappedRow.nationality_iso3) : null;
    if (iso3 && /^[A-Z]{3}$/.test(iso3)) {
      mappedRow.nationality = iso3;
    } else if (mappedRow.nationality) {
      mappedRow.nationality = convertCountryToIso3(mappedRow.nationality);
    }

    // Drop scratch fields we don't want polluting downstream record shape.
    delete mappedRow.nationality_iso3;
    delete mappedRow.name_last;
    delete mappedRow.name_first;

    // Skip rows that are clearly not passengers (e.g. trailing totals line
    // where every meaningful cell is empty after mapping).
    const looksEmpty = !mappedRow.passport_number && !mappedRow.name
      && !mappedRow.date_of_birth && !mappedRow.nationality;
    if (looksEmpty) continue;

    mappedRow._rowIndex = i + 1;
    rows.push(mappedRow);
  }

  return rows;
}

module.exports = {
  parseXlsx,
  mapHeaders,
  listSheets,
  describeSheets,
  // exported for tests / reuse
  findHeaderRow,
  convertCountryToIso3,
  normalizeHeader
};
