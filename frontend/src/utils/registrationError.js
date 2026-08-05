export const REGISTRATION_ERROR_FALLBACK = 'Unable to create account. Please try again.';

const asMessage = (value) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value.message === 'string' && value.message.trim()) return value.message.trim();
  return '';
};

export function getRegistrationErrorMessage(error) {
  const data = error?.response?.data;
  const candidates = [
    data?.message,
    data?.error,
    data?.detail,
    ...(Array.isArray(data?.errors) ? data.errors : []),
    typeof data === 'string' ? data : '',
  ];

  return candidates.map(asMessage).find(Boolean) || REGISTRATION_ERROR_FALLBACK;
}
