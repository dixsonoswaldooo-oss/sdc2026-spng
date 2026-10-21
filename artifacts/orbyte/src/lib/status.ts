import { CircleCheck, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { Status } from '@/api/types';

/** How each status looks. Always icon + text, never colour alone. */
export const STATUS_META: Record<Status, { label: string; icon: typeof CircleCheck; text: string; tint: string; token: string }> = {
  SAFE: { label: 'Safe', icon: CircleCheck, text: 'text-safe', tint: 'bg-safe/10', token: 'safe' },
  AT_RISK: { label: 'At risk', icon: TriangleAlert, text: 'text-at-risk', tint: 'bg-at-risk/10', token: 'at-risk' },
  SHORTFALL: { label: 'Shortfall', icon: OctagonAlert, text: 'text-shortfall', tint: 'bg-shortfall/10', token: 'shortfall' },
};

/** Reads a colour token for places that need a real colour value (chart lines). */
export function tokenColor(token: string): string {
  return `rgb(${getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim()})`;
}
