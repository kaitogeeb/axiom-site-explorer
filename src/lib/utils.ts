import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112');
    const data = await response.json();
    return data['So11111111111111111111111111111111111111112']?.usdPrice || 0;
  } catch (error) {
    console.error('Error fetching SOL price:', error);
    return 0;
  }
}
