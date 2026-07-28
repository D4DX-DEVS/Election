import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Name fields must contain at least one letter — rejects "123", "007", "12 34". */
export function isValidNameField(value: string): boolean {
  return /[a-zA-Z]/.test(value.trim());
}
