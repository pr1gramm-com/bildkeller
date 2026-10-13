const Z = 1.96; // 95% confidence

/** Wilson score lower bound — orders by confidence, not raw ratio. */
export function wilson(up: number, down: number): number {
  const n = up + down;
  if (n === 0) return 0;
  const p = up / n;
  const z2 = Z * Z;
  return (
    (p + z2 / (2 * n) - Z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / (1 + z2 / n)
  );
}
