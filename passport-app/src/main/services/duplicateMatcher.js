/**
 * duplicateMatcher.js
 * In-memory matching for exact and fuzzy duplicates within the current session.
 */
const indices = require('../store/indices');

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Detects if a normalized passenger is a duplicate.
 * @param {Object} normalized 
 * @returns {Object} { kind: 'none' | 'exact' | 'fuzzy', existingPassengerId?: string, differences?: string[] }
 */
function detect(normalized) {
  const { passportNumberKey, name, dob, nationality } = normalized;
  
  // Exact match by passport number key
  if (passportNumberKey) {
    const existingExact = indices.getByPassportKey(passportNumberKey);
    if (existingExact) {
      return { kind: 'exact', existingPassengerId: existingExact.id };
    }
  }

  // Fuzzy match candidates based on indices (e.g. searching by name/dob/nationality)
  // For simplicity, we iterate over all session passengers if indices don't provide a direct fuzzy map,
  // but indices should probably expose getAll() or we just check if indices has a partial match.
  // The spec says: fuzzy match on name+DOB+nationality with <=2 differing/missing fields.
  
  const allPassengers = indices.getAll ? indices.getAll() : [];
  
  for (const p of allPassengers) {
    // skip self if somehow in there
    if (normalized.id && p.id === normalized.id) continue;

    let diffCount = 0;
    const differences = [];

    // Compare DOB
    if (p.date_of_birth !== dob) {
      diffCount++;
      differences.push('dob');
    }
    
    // Compare Nationality
    if (p.nationality !== nationality) {
      diffCount++;
      differences.push('nationality');
    }

    // Compare Name using Levenshtein
    const nameDist = levenshtein((p.name || '').toUpperCase(), (name || '').toUpperCase());
    if (nameDist > 2) {
      // name is too different -> not a fuzzy match
      continue;
    } else if (nameDist > 0) {
      diffCount++;
      differences.push('name');
    }

    // If diffCount <= 2 and we haven't continued (meaning nameDist <= 2)
    // we consider it a fuzzy match. 
    // Wait, if diffCount == 0, it means name, dob, nationality perfectly match but passport is different.
    if (diffCount <= 2) {
      return {
        kind: 'fuzzy',
        existingPassengerId: p.id,
        differences
      };
    }
  }

  return { kind: 'none' };
}

module.exports = { detect, levenshtein };
