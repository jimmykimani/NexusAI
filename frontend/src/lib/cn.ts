import clsx, { type ClassValue } from 'clsx'

/** Thin re-export: merge class names, skip falsy values. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
