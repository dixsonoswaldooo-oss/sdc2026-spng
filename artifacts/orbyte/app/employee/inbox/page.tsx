'use client';
import { PageHead } from '@/components/ui';
import { WhatsAppList } from '@/components/WhatsAppList';
import { useMe } from '@/lib/useMe';

export default function Inbox() {
  const { data, me } = useMe();
  return (
    <>
      <PageHead eyebrow="WhatsApp" title="Messages to you">
        Every cut from your pay is explained here the moment it happens, not on payday. In a real company this arrives on WhatsApp.
      </PageHead>
      <WhatsAppList messages={data.whatsapp.filter((m) => m.employeeId === me.id)} employees={data.employees} showRecipient={false} />
    </>
  );
}
