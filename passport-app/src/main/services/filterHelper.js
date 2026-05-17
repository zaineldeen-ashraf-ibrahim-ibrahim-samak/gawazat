/**
 * Shared Filter Helper for Main Process
 * Replicates the pure filtering logic of advancedFilterPanel without requiring renderer DOM dependencies.
 */

function applyFilterState(passengers, filterState) {
  if (!filterState) return passengers;
  const { genders, statuses, sources, nationality, dobFrom, dobTo, ageMin, ageMax, hasWarning } = filterState;

  const today = new Date();

  return passengers.filter(p => {
    // Gender (OR logic within genders array)
    if (genders && genders.length > 0 && !genders.includes(p.gender)) return false;

    // Nationality
    if (nationality && p.nationality !== nationality) return false;

    // Source (OR logic within sources array)
    if (sources && sources.length > 0 && !sources.includes(p.source)) return false;

    // Statuses (OR logic within statuses array)
    if (statuses && statuses.length > 0) {
      const match = statuses.some(st => {
        if (st === 'entered')   return p.is_entered;
        if (st === 'pending')   return !p.is_entered;
        if (st === 'duplicate') return p.is_duplicate;
        return false;
      });
      if (!match) return false;
    }

    // Has Warning flag
    if (hasWarning && !p.is_duplicate) return false;

    // DOB range
    if (dobFrom && p.date_of_birth && p.date_of_birth < dobFrom) return false;
    if (dobTo   && p.date_of_birth && p.date_of_birth > dobTo)   return false;

    // Age range (computed from DOB)
    if ((ageMin !== '' && ageMin != null) || (ageMax !== '' && ageMax != null)) {
      if (!p.date_of_birth) return false;
      const dob = new Date(p.date_of_birth);
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      if (ageMin !== '' && ageMin != null && age < ageMin) return false;
      if (ageMax !== '' && ageMax != null && age > ageMax) return false;
    }

    return true;
  });
}

module.exports = { applyFilterState };
