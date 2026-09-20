import { motion } from "framer-motion";

/**
 * A radar sweep, not a generic spinner ring - it reads as "monitoring", the
 * thing SentinelGuard is actually doing while a transaction is pending.
 */
export default function RadarSpinner({ size = 28, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      role="status"
      aria-label="Waiting for consensus"
    >
      <circle cx="20" cy="20" r="18" stroke="#EFEDFF" strokeWidth="2" />
      <circle cx="20" cy="20" r="12" stroke="#EFEDFF" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="6" stroke="#EFEDFF" strokeWidth="1.5" />
      <motion.g
        style={{ transformOrigin: "20px 20px" }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
      >
        <path d="M20 20 L20 2 A18 18 0 0 1 33 8 Z" fill="url(#radar-sweep-grad)" />
      </motion.g>
      <motion.circle
        cx="20"
        cy="20"
        r="2.4"
        fill="#6D5DF5"
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
        transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
      />
      <defs>
        <linearGradient id="radar-sweep-grad" x1="20" y1="2" x2="33" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6D5DF5" stopOpacity="0.85" />
          <stop offset="1" stopColor="#6D5DF5" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
