export default function LoadingSpinner({ size = 16 }) {
  return <span aria-hidden="true" className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent" style={{ width: size, height: size }} />;
}
