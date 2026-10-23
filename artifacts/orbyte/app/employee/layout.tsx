import { AppShell } from '@/components/AppShell';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="EMPLOYEE">{children}</AppShell>;
}
