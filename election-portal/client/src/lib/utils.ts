import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Name fields cannot contain any digits and must contain at least one letter. */
export function isValidNameField(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !/\d/.test(trimmed) && /[a-zA-Z]/.test(trimmed);
}
