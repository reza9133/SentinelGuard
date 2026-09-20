/**
 * A stylized text rendering of "GenLayer", used to credit the network this
 * app is built on. Deliberately typographic rather than a reproduction of
 * any official logo asset.
 */
export default function GenLayerMark({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-display font-semibold ${className}`}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6.25" stroke="#6D5DF5" strokeWidth="1.5" />
        <circle cx="7" cy="7" r="2.4" fill="#6D5DF5" />
      </svg>
      <span className="tracking-tight">
        Gen<span className="text-chain-500">Layer</span>
      </span>
    </span>
  );
}
