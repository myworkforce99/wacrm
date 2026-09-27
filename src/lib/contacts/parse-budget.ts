export function parseBudget(input: string): number | null {
  if (!input) return null;
  const normalized = input.toLowerCase().replace(/,/g, '').trim();
  
  // Extract numbers (can be decimal like 1.5)
  const numMatch = normalized.match(/[\d.]+/);
  if (!numMatch) return null;
  const num = parseFloat(numMatch[0]);
  if (isNaN(num)) return null;

  // Check for lakh/crore multipliers
  if (normalized.includes('cr') || normalized.includes('crore')) {
    return num * 10000000;
  }
  if (normalized.includes('l') || normalized.includes('lac') || normalized.includes('lakh')) {
    return num * 100000;
  }
  if (normalized.includes('k') || normalized.includes('thousand')) {
    return num * 1000;
  }
  if (normalized.includes('m') || normalized.includes('million')) {
    return num * 1000000;
  }

  // If no multiplier, assume the number is already the raw value
  return num;
}
