/**
 * Minimal clsx-compatible helper for className composition.
 */

export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | ClassDictionary;

export type ClassDictionary = Record<string, unknown>;

export function clsx(inputs: ClassValue[]): string {
  const classes: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === "string" || typeof input === "number") {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const inner = clsx(input);
      if (inner) classes.push(inner);
    } else if (typeof input === "object") {
      for (const key in input) {
        if ((input as ClassDictionary)[key]) classes.push(key);
      }
    }
  }
  return classes.join(" ");
}
