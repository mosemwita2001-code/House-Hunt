const CLOUDINARY_UPLOAD_PATH = '/image/upload/';

export function optimizeImageUrl(value, { width } = {}) {
  if (typeof value !== 'string' || !value.trim()) return value;

  const url = value.trim();
  const markerIndex = url.indexOf(CLOUDINARY_UPLOAD_PATH);
  if (!url.includes('res.cloudinary.com') || markerIndex === -1) return url;

  const pathStart = markerIndex + CLOUDINARY_UPLOAD_PATH.length;
  const path = url.slice(pathStart);
  const firstSegment = path.split('/')[0];
  const existing = new Set(firstSegment.split(','));
  const transformations = [];

  if (!existing.has('f_auto')) transformations.push('f_auto');
  if (!existing.has('q_auto')) transformations.push('q_auto');
  if (width && !/\bw_\d+\b/.test(firstSegment)) transformations.push(`c_limit,w_${Math.round(width)}`);
  if (!transformations.length) return url;

  return `${url.slice(0, pathStart)}${transformations.join(',')}/${path}`;
}
