import test from 'node:test';
import assert from 'node:assert/strict';
import { amenitiesForResponse, normalizeAmenities } from '../utils/amenities.js';

test('normalizes amenities arrays by trimming, removing blanks, and deduplicating', () => {
  assert.deepEqual(normalizeAmenities([' WiFi ', '', 'Parking', 'WiFi', '  ']), ['WiFi', 'Parking']);
});

test('parses JSON and legacy comma-delimited multipart values', () => {
  assert.deepEqual(normalizeAmenities('["WiFi", "Parking", "WiFi"]'), ['WiFi', 'Parking']);
  assert.deepEqual(normalizeAmenities('WiFi, Parking, WiFi'), ['WiFi', 'Parking']);
});

test('rejects non-array values and treats legacy null values as empty responses', () => {
  assert.equal(normalizeAmenities({ name: 'WiFi' }), null);
  assert.deepEqual(amenitiesForResponse(null), []);
});
