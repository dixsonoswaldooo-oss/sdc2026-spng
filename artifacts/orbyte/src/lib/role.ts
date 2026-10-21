import { createContext, useContext } from 'react';
import type { Role } from '@/api/types';

export const ROLE_LABELS: Record<Role, string> = { OWNER: 'Owner', FINANCE_ADMIN: 'Finance Admin' };

export const RoleContext = createContext<{ role: Role; setRole: (role: Role) => void } | null>(null);

/** The demo role picked in the top bar ("View as"). */
export function useRole() {
  const value = useContext(RoleContext);
  if (!value) throw new Error('useRole must be used inside RoleProvider');
  return value;
}
