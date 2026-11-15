/** Logo "Linh Cáo" — đầu cáo hình học trên khung 64×64 (đồng bộ với app/icon.svg). */
export const FOX = {
  head: "M10 6 L26 20 L38 20 L54 6 L56 30 L32 58 L8 30 Z",
  ears: "M14 12 L23 21 L15 27 Z M50 12 L41 21 L49 27 Z",
  cheeks: "M8 30 L22 34 L32 58 Z M56 30 L42 34 L32 58 Z",
  nose: "M28.5 50 h7 L32 55 Z",
  eyes: [
    [23.5, 30],
    [40.5, 30],
  ] as const,
};

export function FoxMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d={FOX.head} fill="#f97316" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
      <path d={FOX.ears} fill="#7c2d12" />
      <path d={FOX.cheeks} fill="#fff" />
      {FOX.eyes.map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="2.8" fill="#1e293b" />
      ))}
      <path d={FOX.nose} fill="#1e293b" />
    </svg>
  );
}

/** Vẽ đầu cáo lên canvas 2D, tâm (cx, cy), cạnh `size` px. */
export function drawFox(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 64, size / 64);
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#f97316";
  const head = new Path2D(FOX.head);
  ctx.fill(head);
  ctx.stroke(head);
  ctx.fillStyle = "#7c2d12";
  ctx.fill(new Path2D(FOX.ears));
  ctx.fillStyle = "#fff";
  ctx.fill(new Path2D(FOX.cheeks));
  ctx.fillStyle = "#1e293b";
  for (const [x, y] of FOX.eyes) {
    ctx.beginPath();
    ctx.arc(x, y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fill(new Path2D(FOX.nose));
  ctx.restore();
}
