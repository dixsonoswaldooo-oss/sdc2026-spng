import { useState, type ReactNode } from 'react';
import { setRole as setClientRole } from '@/api/client';
import type { Role } from '@/api/types';
import { RoleContext } from '@/lib/role';

/** Holds the demo role and tells the API client, which sends it with every request. Starts as Owner. */
export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>('OWNER');
  const setRole = (next: Role) => {
    setClientRole(next);
    setRoleState(next);
  };
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}
