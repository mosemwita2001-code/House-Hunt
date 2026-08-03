import test from 'node:test';
import assert from 'node:assert/strict';
import { pagination } from '../pagination.js';

test('pagination uses safe defaults for malformed values', () => {
  assert.deepEqual(pagination({ page: '2abc', limit: '24.5' }), {
    page: 1,
    limit: 24,
    offset: 0,
  });
});

test('pagination clamps valid values and derives a safe integer offset', () => {
  assert.deepEqual(pagination({ page: '1000001', limit: '1000' }), {
    page: 1_000_000,
    limit: 100,
    offset: 99_999_900,
  });
});
