import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Name fields can mix letters and numbers, but cannot be numbers-only (e.g. "12345"). */
export function isValidNameField(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && /[a-zA-Z]/.test(trimmed);
}

/** Franchise/Election names: letters only, no digits at all (e.g. "Team 7" is rejected). */
export function isLettersOnlyName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !/\d/.test(trimmed) && /[a-zA-Z]/.test(trimmed);
}
