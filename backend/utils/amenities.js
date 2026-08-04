export function normalizeAmenities(value = []) {
  let candidate = value;

  if (candidate === null || candidate === undefined || candidate === '') return [];

  if (typeof candidate === 'string') {
    const text = candidate.trim();
    if (!text) return [];
    try {
      candidate = JSON.parse(text);
    } catch {
      // Accept the existing multipart form representation while clients migrate
      // to the JSON array representation.
      candidate = text.split(',');
    }
  }

  if (!Array.isArray(candidate)) return null;

  const seen = new Set();
  const amenities = [];
  for (const value of candidate) {
    if (typeof value !== 'string') return null;
    const amenity = value.trim();
    if (amenity && !seen.has(amenity)) {
      seen.add(amenity);
      amenities.push(amenity);
    }
  }
  return amenities;
}

export function amenitiesForResponse(value) {
  return normalizeAmenities(value) || [];
}
