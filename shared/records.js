export const GROUP_TYPES = Object.freeze(['साधु', 'साध्वी']);

/**
 * Returns a blank canonical group record with all fields at their zero values.
 * @returns {object}
 */
export function emptyRecord() {
  return {
    zone: '', zoneOrder: 0, serial: 0, groupType: 'साधु',
    members: [], thana: null, viharRoute: '', place: '',
    city: '', district: '', km: null,
    viharKarmi: [], activePersons: [],
    lat: null, lng: null, geocodeStatus: 'failed',
  };
}

function contactText(list) {
  return (list || [])
    .map((c) => [c.name, c.phone].filter(Boolean).join(' '))
    .join(' ');
}

/**
 * Flattens a canonical group record into a single NFC-normalized search string.
 * @param {object} rec canonical group record
 * @returns {string}
 */
export function recordToSearchText(rec) {
  const parts = [
    rec.zone, rec.groupType, (rec.members || []).join(' '),
    rec.viharRoute, rec.place, rec.city, rec.district,
    rec.km == null ? '' : String(rec.km),
    contactText(rec.viharKarmi), contactText(rec.activePersons),
  ];
  return parts.join(' ').replace(/\s+/g, ' ').trim().normalize('NFC');
}
