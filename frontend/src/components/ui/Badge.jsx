const TONES = {
  active: "bg-active-50 text-active-900 border-active-300",
  halted: "bg-halted-50 text-halted-900 border-halted-300",
  pending: "bg-pending-50 text-pending-900 border-pending-300",
  muted: "bg-black/[0.03] text-muted border-black/10",
};

export default function Badge({ tone = "muted", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}
