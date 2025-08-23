/**
 * Format a number as currency (USD)
 */
export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

/**
 * Safely convert a value to a number with fallback
 */
export function safeNumber(n: any, fallback: number = 0): number {
  if (typeof n === 'number' && !isNaN(n)) {
    return n;
  }
  if (typeof n === 'string') {
    const parsed = parseFloat(n);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
}