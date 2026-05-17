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

// Map full country names (uppercased) to ISO 3166-1 alpha-3. Covers the cases
// seen in the cruise manifests and common nationalities; AI / local normalize
// catches anything else.
const COUNTRY_TO_ISO3 = {
  'UNITED KINGDOM': 'GBR', 'GREAT BRITAIN': 'GBR', 'BRITAIN': 'GBR', 'ENGLAND': 'GBR',
  'UNITED STATES': 'USA', 'UNITED STATES OF AMERICA': 'USA', 'USA': 'USA', 'AMERICA': 'USA',
  'EGYPT': 'EGY', 'GERMANY': 'DEU', 'AUSTRIA': 'AUT', 'BELGIUM': 'BEL', 'SPAIN': 'ESP',
  'FRANCE': 'FRA', 'ITALY': 'ITA', 'NETHERLANDS': 'NLD', 'HOLLAND': 'NLD', 'PORTUGAL': 'PRT',
  'GREECE': 'GRC', 'SWITZERLAND': 'CHE', 'SWEDEN': 'SWE', 'NORWAY': 'NOR', 'DENMARK': 'DNK',
  'FINLAND': 'FIN', 'POLAND': 'POL', 'ROMANIA': 'ROU', 'BULGARIA': 'BGR', 'CZECH REPUBLIC': 'CZE',
  'CZECHIA': 'CZE', 'HUNGARY': 'HUN', 'IRELAND': 'IRL', 'ICELAND': 'ISL', 'SLOVAKIA': 'SVK',
  'SLOVENIA': 'SVN', 'CROATIA': 'HRV', 'SERBIA': 'SRB', 'TURKEY': 'TUR', 'TÜRKIYE': 'TUR',
  'RUSSIA': 'RUS', 'RUSSIAN FEDERATION': 'RUS', 'UKRAINE': 'UKR', 'BELARUS': 'BLR',
  'CHINA': 'CHN', 'JAPAN': 'JPN', 'SOUTH KOREA': 'KOR', 'KOREA': 'KOR', 'NORTH KOREA': 'PRK',
  'INDIA': 'IND', 'PAKISTAN': 'PAK', 'BANGLADESH': 'BGD', 'PHILIPPINES': 'PHL',
  'INDONESIA': 'IDN', 'MALAYSIA': 'MYS', 'SINGAPORE': 'SGP', 'THAILAND': 'THA', 'VIETNAM': 'VNM',
  'AUSTRALIA': 'AUS', 'NEW ZEALAND': 'NZL', 'CANADA': 'CAN', 'MEXICO': 'MEX', 'BRAZIL': 'BRA',
  'ARGENTINA': 'ARG', 'CHILE': 'CHL', 'COLOMBIA': 'COL', 'PERU': 'PER', 'VENEZUELA': 'VEN',
  'SAUDI ARABIA': 'SAU', 'UNITED ARAB EMIRATES': 'ARE', 'UAE': 'ARE', 'KUWAIT': 'KWT',
  'QATAR': 'QAT', 'BAHRAIN': 'BHR', 'OMAN': 'OMN', 'JORDAN': 'JOR', 'LEBANON': 'LBN',
  'SYRIA': 'SYR', 'IRAQ': 'IRQ', 'IRAN': 'IRN', 'ISRAEL': 'ISR', 'PALESTINE': 'PSE',
  'YEMEN': 'YEM', 'LIBYA': 'LBY', 'TUNISIA': 'TUN', 'ALGERIA': 'DZA', 'MOROCCO': 'MAR',
  'SUDAN': 'SDN', 'SOUTH SUDAN': 'SSD', 'ETHIOPIA': 'ETH', 'KENYA': 'KEN', 'NIGERIA': 'NGA',
  'GHANA': 'GHA', 'SOUTH AFRICA': 'ZAF', 'ZIMBABWE': 'ZWE',
  'AFGHANISTAN': 'AFG', 'ARMENIA': 'ARM', 'AZERBAIJAN': 'AZE', 'GEORGIA': 'GEO',
  'KAZAKHSTAN': 'KAZ', 'UZBEKISTAN': 'UZB', 'TURKMENISTAN': 'TKM', 'TAJIKISTAN': 'TJK',
  'KYRGYZSTAN': 'KGZ', 'MONGOLIA': 'MNG', 'SRI LANKA': 'LKA', 'NEPAL': 'NPL'
};

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
  const upper = s.toUpperCase();
  // Map known informal/truncated 3-letter codes first — these collide with the
  // "looks-like-ISO3" shortcut below, so they have to win.
  if (TRUNCATION_TO_ISO3[upper]) return TRUNCATION_TO_ISO3[upper];
  if (upper.length === 3 && /^[A-Z]{3}$/.test(upper)) return upper;
  return COUNTRY_TO_ISO3[upper] || s;
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
  const chosen = sheetName && workbook.SheetNames.includes(sheetName)
    ? sheetName
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[chosen];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (data.length < 2) {
    throw new Error('File must contain at least one data row (plus header)');
  }

  const { headerRowIndex, headerMap, score } = findHeaderRow(data);

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
  // exported for tests / reuse
  findHeaderRow,
  convertCountryToIso3,
  normalizeHeader
};
