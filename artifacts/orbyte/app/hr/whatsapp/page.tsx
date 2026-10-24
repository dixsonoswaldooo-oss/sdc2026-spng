'use client';
import { useState } from 'react';
import { PageHead } from '@/components/ui';
import { WhatsAppList } from '@/components/WhatsAppList';
import { useStore } from '@/lib/store';

export default function Outbox() {
  const { data } = useStore();
  const [who, setWho] = useState('ALL');
  const messages = data.whatsapp.filter((m) => who === 'ALL' || m.employeeId === who);
  return (
    <>
      <PageHead
        eyebrow="WhatsApp sent"
        title="Messages sent"
        action={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Recipient</span>
            <select value={who} onChange={(e) => setWho(e.target.value)} className="rounded-[var(--radius-sm)] border border-line bg-white px-3 py-2">
              <option value="ALL">Everyone ({data.whatsapp.length})</option>
              {data.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
        }
      >
        See every WhatsApp the app sent: one per new pay cut, one when a cut changes, and overtime offers. Simulated: nothing leaves this app.
      </PageHead>
      <WhatsAppList messages={messages} employees={data.employees} showRecipient />
    </>
  );
}
