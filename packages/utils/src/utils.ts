import { clsx, type ClassValue } from "./clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
