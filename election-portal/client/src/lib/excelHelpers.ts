/** Sets a readable column width (in characters) per key, sized to the longest value. */
export function autoSizeColumns<T extends Record<string, unknown>>(rows: T[]): { wch: number }[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((key) => {
    const longest = rows.reduce((max, row) => {
      const value = row[key];
      return Math.max(max, String(value ?? "").length);
    }, key.length);
    return { wch: Math.min(Math.max(longest + 2, 10), 40) };
  });
}
