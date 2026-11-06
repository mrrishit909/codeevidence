// Checked integer arithmetic. Any failure throws an error carrying a stable code so the
// engine can reject the whole batch instead of producing partial totals.

export const INTEGER_OVERFLOW = 'INTEGER_OVERFLOW';
export const INTEGER_INVALID = 'INTEGER_INVALID';

export class IntegerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'IntegerError';
    this.code = code;
  }
}

export function isNonNegativeSafeInteger(n) {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
}

// Adds b to a. Requires both safe integers, b >= 0, and no overflow past MAX_SAFE_INTEGER.
export function checkedAdd(a, b) {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    throw new IntegerError(INTEGER_INVALID, 'checkedAdd requires safe integers');
  }
  if (b < 0) {
    throw new IntegerError(INTEGER_INVALID, 'checkedAdd requires a non-negative addend');
  }
  if (b > Number.MAX_SAFE_INTEGER - a) {
    throw new IntegerError(INTEGER_OVERFLOW, 'integer overflow while adding');
  }
  return a + b;
}

// Subtracts b from a where 0 <= b <= a. Used for derived counts only.
export function checkedSubtract(a, b) {
  if (!isNonNegativeSafeInteger(a) || !isNonNegativeSafeInteger(b) || b > a) {
    throw new IntegerError(INTEGER_INVALID, 'checkedSubtract requires 0 <= b <= a as safe integers');
  }
  return a - b;
}
