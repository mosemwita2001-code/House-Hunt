const MAX_PAGE = 1_000_000;
const MAX_LIMIT = 100;

const toPositiveInt = (value, fallback, maximum) => {
  const raw = Array.isArray(value) ? '' : String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return fallback;

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
};

export const pagination = query => {
  const page = toPositiveInt(query?.page, 1, MAX_PAGE);
  const limit = toPositiveInt(query?.limit, 24, MAX_LIMIT);
  return { page, limit, offset: (page - 1) * limit };
};
