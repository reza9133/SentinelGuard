import { motion } from "framer-motion";

const VARIANTS = {
  primary:
    "bg-chain-500 text-white shadow-lift hover:bg-chain-600 disabled:bg-chain-300 disabled:cursor-not-allowed",
  secondary:
    "bg-white text-ink border border-black/10 hover:border-chain-500 hover:text-chain-600 disabled:opacity-50",
  ghost: "text-ink hover:text-chain-600",
};

export default function Button({
  as: Tag = "button",
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  const sizing = size === "sm" ? "px-3.5 py-2 text-sm" : "px-5 py-2.5 text-[15px]";
  const MotionTag = motion[Tag] ?? motion.button;
  return (
    <MotionTag
      whileTap={{ scale: 0.97 }}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-150 ${sizing} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </MotionTag>
  );
}
