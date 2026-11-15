/** Logo "Linh Cáo" — đầu cáo hình học (đồng bộ với app/icon.svg). */
export function FoxMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M10 6 L26 20 L38 20 L54 6 L56 30 L32 58 L8 30 Z" fill="#f97316" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 12 L23 21 L15 27 Z M50 12 L41 21 L49 27 Z" fill="#7c2d12" />
      <path d="M8 30 L22 34 L32 58 Z M56 30 L42 34 L32 58 Z" fill="#fff" />
      <circle cx="23.5" cy="30" r="2.8" fill="#1e293b" />
      <circle cx="40.5" cy="30" r="2.8" fill="#1e293b" />
      <path d="M28.5 50 h7 L32 55 Z" fill="#1e293b" strokeLinejoin="round" />
    </svg>
  );
}
