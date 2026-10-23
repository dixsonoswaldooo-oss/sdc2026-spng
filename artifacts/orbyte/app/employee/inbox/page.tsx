'use client';
import { PageHead } from '@/components/ui';
import { WhatsAppList } from '@/components/WhatsAppList';
import { useMe } from '@/lib/useMe';

export default function Inbox() {
  const { data, me } = useMe();
  return (
    <>
      <PageHead eyebrow="WhatsApp inbox" title="Messages to you">
        Every deduction is explained here (and by WhatsApp in a real deployment) the moment it appears, not on payday.
      </PageHead>
      <WhatsAppList messages={data.whatsapp.filter((m) => m.employeeId === me.id)} employees={data.employees} showRecipient={false} />
    </>
  );
}
