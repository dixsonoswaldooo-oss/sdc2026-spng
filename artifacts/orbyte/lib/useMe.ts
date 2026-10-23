'use client';
import { useStore } from './store';

/** The signed-in employee (employee pages only ever show this person's data). */
export function useMe() {
  const store = useStore();
  const me = store.data.employees.find((e) => e.id === store.account?.employeeId);
  if (!me) throw new Error('Not signed in as an employee.');
  return { ...store, me };
}
