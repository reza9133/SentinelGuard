import genlayerLogo from "../../assets/genlayer-logo.png";

/**
 * The real GenLayer mark, credited alongside "GenLayer" text wherever the
 * app needs to say "built on GenLayer" (footer, header). Kept in its
 * original black - it's a wordmark/brand asset, not a UI accent, so it
 * isn't recolored to match the app's own violet/blue palette.
 */
export default function GenLayerMark({ className = "", size = 16 }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-display font-semibold ${className}`}>
      <img src={genlayerLogo} alt="" width={size} height={size} className="shrink-0" />
      <span className="tracking-tight">
        Gen<span className="text-chain-500">Layer</span>
      </span>
    </span>
  );
}
