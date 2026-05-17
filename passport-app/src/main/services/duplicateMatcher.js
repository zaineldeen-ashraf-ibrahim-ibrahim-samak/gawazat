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

  // NOTE: An exact passport-number match against the manifest is NOT a duplicate —
  // manifest entries are the *expected* passengers to be scanned. scanProcessor
  // handles that case (green outcome) and also flags re-scans against boarding/pending
  // records (orange outcome). Only fuzzy matches are surfaced here so the operator
  // can be prompted with "Is this <existing passenger>?" for near-matches.

  // Fuzzy match candidates based on indices (e.g. searching by name/dob/nationality)
  // For simplicity, we iterate over all session passengers if indices don't provide a direct fuzzy map,
  // but indices should probably expose getAll() or we just check if indices has a partial match.
  // The spec says: fuzzy match on name+DOB+nationality with <=2 differing/missing fields.
  
  const allPassengers = indices.getAll ? indices.getAll() : [];
  
  for (const p of allPassengers) {
    // skip self if somehow in there
    if (normalized.id && p.id === normalized.id) continue;

    // Passport-number exact matches are handled downstream in scanProcessor
    // (manifest match → green, already boarded/pending → orange). Don't surface
    // them as a fuzzy prompt.
    if (passportNumberKey && p.passport_number_normalized === passportNumberKey) continue;

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

/**
 * Score a single manifest candidate against the incoming normalized scan.
 * Lower score = better match. Returns null if the candidate is too dissimilar
 * (name Levenshtein > 4) to be worth surfacing as a recommendation.
 *
 * Scoring rules:
 *   - Name Levenshtein distance contributes directly to the score.
 *   - Each mismatching/missing comparable field (DOB, nationality) adds 1.
 *   - Missing incoming fields are ignored (we can't say they differ).
 */
function scoreCandidate(p, normalized) {
  const { name, dob, nationality, passportNumberKey } = normalized;
  const differences = [];

  let score = 0;

  // Name Levenshtein
  const nameDist = (name && p.name)
    ? levenshtein(String(p.name).toUpperCase(), String(name).toUpperCase())
    : (name || p.name ? 4 : 0); // one side missing → moderate penalty
  if (nameDist > 4) return null;
  score += nameDist;
  if (nameDist > 0 && (name || p.name)) differences.push('name');

  // DOB
  if (dob && p.date_of_birth && p.date_of_birth !== dob) {
    score += 2;
    differences.push('dob');
  }

  // Nationality
  if (nationality && p.nationality && p.nationality !== nationality) {
    score += 2;
    differences.push('nationality');
  }

  // Passport-number near match (same prefix or contains): small bonus toward score
  if (passportNumberKey && p.passport_number_normalized) {
    const a = String(passportNumberKey).toUpperCase();
    const b = String(p.passport_number_normalized).toUpperCase();
    if (a !== b) {
      const pnDist = levenshtein(a, b);
      // Treat very-different passport numbers as weakly informative; cap effect.
      score += Math.min(pnDist, 3);
      if (pnDist > 0) differences.push('passportNumber');
    }
  }

  return { passenger: p, score, differences };
}

/**
 * Return ranked candidate passengers from the manifest that resemble the
 * incoming scan. Use this BEFORE creating a pending-approval entry to give the
 * operator a chance to confirm "this is actually <existing passenger>" when
 * one or two scan fields are missing or slightly off.
 *
 * @param {Object} normalized — incoming scan fields (passportNumberKey, name, dob, nationality)
 * @param {number} limit — max candidates to return
 * @returns {Array<{passenger, score, differences}>} sorted best-first
 */
function detectCandidates(normalized, limit = 5) {
  if (!normalized) return [];
  const allPassengers = indices.getAll ? indices.getAll() : [];
  const candidates = [];
  for (const p of allPassengers) {
    if (normalized.id && p.id === normalized.id) continue;
    // Exact passport hits are handled by scanProcessor's downstream flow.
    if (normalized.passportNumberKey && p.passport_number_normalized === normalized.passportNumberKey) continue;
    const scored = scoreCandidate(p, normalized);
    if (scored) candidates.push(scored);
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates.slice(0, limit);
}

module.exports = { detect, detectCandidates, levenshtein };
