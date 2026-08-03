import { describe, expect, it } from 'vitest';
import { viewAccessHeaders, viewAccessStorageKey } from './viewAccess';

describe('view access helpers', () => {
  it('isolates a token by viewer and property', () => {
    expect(viewAccessStorageKey(7, 12)).toBe('view_access_token_7_12');
    expect(viewAccessStorageKey(null, 12)).toBe('view_access_token_guest_12');
  });

  it('does not create an empty access header', () => {
    expect(viewAccessHeaders('')).toEqual({});
    expect(viewAccessHeaders('opaque-token')).toEqual({ 'X-View-Access-Token': 'opaque-token' });
  });
});
