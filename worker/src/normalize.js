/**
 * Builds the two published artifacts: dataJson (sorted records) and
 * metaJson (totals for the summary bar + geocodeFailures for the upload
 * result page and the map's "not on map" panel).
 *
 * @param {object[]} records  - Parsed records from the geocode step.
 * @param {{ fileName: string, now: string }} opts - Source filename and ISO timestamp.
 * @returns {{ dataJson: object, metaJson: object }}
 */
export function buildOutputs(records, { fileName, now }) {
  const sorted = [...records].sort(
    (a, b) => a.zoneOrder - b.zoneOrder || a.serial - b.serial,
  );

  const totals = {
    groups: sorted.length,
    members: sorted.reduce((n, r) => n + (r.members?.length || 0), 0),
    sadhu: sorted.filter((r) => r.groupType === 'साधु')
      .reduce((n, r) => n + (r.members?.length || 0), 0),
    sadhvi: sorted.filter((r) => r.groupType === 'साध्वी')
      .reduce((n, r) => n + (r.members?.length || 0), 0),
    mapped: sorted.filter((r) => r.lat != null && r.lng != null).length,
    geocodeFailed: sorted.filter((r) => r.lat == null || r.lng == null).length,
  };

  const geocodeFailures = sorted
    .filter((r) => r.lat == null || r.lng == null)
    .map((r) => ({ zone: r.zone, serial: r.serial, city: r.city, district: r.district }));

  return {
    dataJson: { version: 1, records: sorted },
    metaJson: { version: 1, uploadedAt: now, fileName, totals, geocodeFailures },
  };
}
