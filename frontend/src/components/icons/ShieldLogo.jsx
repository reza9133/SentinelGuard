import { useId } from "react";

/**
 * A shield with a watching aperture at its center - the two ideas the
 * product actually combines (a guardian that halts, and a monitor that
 * watches continuously for evidence).
 */
export default function ShieldLogo({ size = 40, className = "" }) {
  const gradId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 112"
      fill="none"
      className={className}
      role="img"
      aria-label="SentinelGuard"
    >
      <defs>
        <linearGradient id={gradId} x1="10" y1="4" x2="90" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6D5DF5" />
          <stop offset="1" stopColor="#2686C4" />
        </linearGradient>
      </defs>
      <path
        d="M50 4 L90 21 V54.5 C90 80 70.5 96 50 108 C29.5 96 10 80 10 54.5 V21 Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M50 8.5 L86 24 V54.5 C86 78 68 92.8 50 103.6 C32 92.8 14 78 14 54.5 V24 Z"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.5"
      />
      {/* the watching aperture */}
      <path
        d="M28 55 C34 42 44 36 50 36 C56 36 66 42 72 55 C66 68 56 74 50 74 C44 74 34 68 28 55 Z"
        fill="rgba(255,255,255,0.92)"
      />
      <circle cx="50" cy="55" r="9" fill="#251E63" />
      <circle cx="53.2" cy="51.8" r="2.6" fill="#FFFFFF" />
    </svg>
  );
}
