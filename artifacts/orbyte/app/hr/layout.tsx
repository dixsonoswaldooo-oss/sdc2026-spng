import { AppShell } from '@/components/AppShell';

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="HR">{children}</AppShell>;
}
