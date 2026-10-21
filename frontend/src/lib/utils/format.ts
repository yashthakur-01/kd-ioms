/**
 * Formats a photo path/URL into an absolute URL or root-relative path
 * safe for HTML <img> rendering.
 */
export function formatPhotoUrl(path?: string | null): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('/')) {
    return path;
  }
  return `/${path}`;
}
