import { describe, expect, it } from 'vitest';
import { getRegistrationErrorMessage, REGISTRATION_ERROR_FALLBACK } from './registrationError';

describe('registration error messages', () => {
  it('uses the server message for validation errors', () => {
    expect(getRegistrationErrorMessage({ response: { data: { message: 'Email already registered' } } }))
      .toBe('Email already registered');
  });

  it('supports alternate server error payloads', () => {
    expect(getRegistrationErrorMessage({ response: { data: { error: 'Password must be 10-128 characters' } } }))
      .toBe('Password must be 10-128 characters');
    expect(getRegistrationErrorMessage({ response: { data: 'The server rejected the request' } }))
      .toBe('The server rejected the request');
  });

  it('uses a safe fallback for missing or unparseable errors', () => {
    expect(getRegistrationErrorMessage({ response: { data: { code: 'UNKNOWN' } } }))
      .toBe(REGISTRATION_ERROR_FALLBACK);
  });
});
