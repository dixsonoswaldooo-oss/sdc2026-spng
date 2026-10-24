'use client';
import { Conversation } from '@/components/Conversation';
import { PageHead, Panel } from '@/components/ui';
import { useMe } from '@/lib/useMe';

export default function Inbox() {
  const { me } = useMe();
  return (
    <>
      <PageHead eyebrow="Messages" title="Messages with HR">
        Every cut from your pay is explained here the moment it happens, not on payday. You can also answer HR here. In a real company this is WhatsApp.
      </PageHead>
      <Panel><Conversation employeeId={me.id} viewer="WORKER" /></Panel>
    </>
  );
}
