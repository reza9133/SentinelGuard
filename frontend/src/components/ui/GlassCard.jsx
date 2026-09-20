export default function GlassCard({ children, className = "", ...props }) {
  return (
    <div
      className={`glass rounded-2xl shadow-glass ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
