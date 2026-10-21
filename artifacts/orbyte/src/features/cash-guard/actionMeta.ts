import { CalendarClock, CircleCheck, Clock, PackageCheck, Send, X } from 'lucide-react';
import type { ActionStatus, ActionType } from '@/api/types';

export const ACTION_TYPE_META: Record<ActionType, { label: string; icon: typeof Send }> = {
  CHASE_RECEIVABLE: { label: 'Chase receivables', icon: Send },
  RESCHEDULE_BILL: { label: 'Reschedule bill', icon: CalendarClock },
  HOLD_PURCHASE: { label: 'Hold purchase', icon: PackageCheck },
};

export const ACTION_STATUS_META: Record<ActionStatus, { label: string; icon: typeof Send; className: string }> = {
  PROPOSED: { label: 'Proposed', icon: Clock, className: 'bg-canvas text-muted' },
  PENDING_APPROVAL: { label: 'Waiting for Owner', icon: Clock, className: 'bg-accent/10 text-accent' },
  APPROVED: { label: 'Approved', icon: CircleCheck, className: 'bg-safe/10 text-safe' },
  EXECUTED: { label: 'Done', icon: CircleCheck, className: 'bg-safe/10 text-safe' },
  REJECTED: { label: 'Rejected', icon: X, className: 'bg-canvas text-muted' },
};

export const CONFIDENCE_LABEL = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' } as const;

export const isOpenAction = (status: ActionStatus) => status === 'PROPOSED' || status === 'PENDING_APPROVAL';
