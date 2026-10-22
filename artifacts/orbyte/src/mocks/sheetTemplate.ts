// The Google Sheet's layout, filled with the Kopi Kawan demo. Used to create the sheet and, in tests,
// to prove the sheet gives exactly the same numbers as the built-in data.
import { AI_EXPLANATION, DRAFTS } from './fixtures.ts';
import type { SheetTab } from './sheet.ts';

export const SHEET_TEMPLATE: Record<SheetTab, string[][]> = {
  settings: [
    ['Setting', 'Value', 'What it means'],
    ['Company name', 'Kopi Kawan Trading Sdn Bhd', 'Full company name, shown in the top bar'],
    ['Short name', 'Kopi Kawan Trading', 'Shown under the Orbyte logo and at the end of reminder messages'],
    ['Credits', '1240', 'Orbyte credit wallet shown in the top bar'],
    ['Owner name', 'Rizal Hamid', 'The person who approves'],
    ['Finance Admin name', 'Aina Zulkifli', 'The person who prepares and signs reminders'],
    ['Demo today', '2026-10-21', 'The date the demo pretends it is (YYYY-MM-DD)'],
    ['Daily check time', '08:00', 'When the agent ran its daily check (HH:MM)'],
    ['Payday day', '25', 'Day of the month salaries are paid (1 to 28)'],
    ['Alert lead time days', '10', 'How many days before payday Cash Guard starts warning'],
    ['Safety buffer', '2000', 'RM you want left in the bank after payroll'],
    ['Message language', 'EN', 'Language of new reminder drafts: EN or BM'],
    ['Bank balance', '7400', 'RM in the bank today'],
    ['Daily sales average', '1900', 'Average RM of sales per day (POS, last 30 days)'],
    ['Payroll total', '18000', 'Net pay plus EPF, SOCSO and EIS for this payday'],
    ['Staff count', '14', 'Number of staff on this payroll'],
    ['Allow chase invoices', 'yes', 'May Cash Guard suggest chasing overdue invoices? yes or no'],
    ['Allow move bills', 'yes', 'May it suggest moving bills within their terms? yes or no'],
    ['Allow hold orders', 'yes', 'May it suggest holding non-urgent purchase orders? yes or no'],
    ['AI explanation', AI_EXPLANATION, 'Optional. Leave empty and the explanation is written from the numbers'],
  ],
  invoices: [
    ['Invoice ID', 'Customer', 'Contact name', 'Amount', 'Due date', 'Likely to pay %', 'Channel', 'Message EN', 'Message BM'],
    ['INV-1021', 'Restoran Seri Melaka', 'Encik Faizal', '4500', '2026-09-30', '90%', 'WhatsApp', DRAFTS['INV-1021'].EN[0], DRAFTS['INV-1021'].BM[0]],
    ['INV-1027', 'Hotel Damai Cheras', 'Puan Mei Ling', '3100', '2026-10-09', '70%', 'Email', DRAFTS['INV-1027'].EN[0], DRAFTS['INV-1027'].BM[0]],
    ['INV-1031', 'Kafe Bunga Raya', 'Cik Nadia', '1600', '2026-10-13', '60%', 'WhatsApp', DRAFTS['INV-1031'].EN[0], DRAFTS['INV-1031'].BM[0]],
    ['INV-1042', 'Kafe Lorong', 'Encik Hafiz', '1500', '2026-10-23', '95%', 'WhatsApp', '', ''],
    ['INV-1045', 'Brew Lab KL', 'Cik Sofia', '1300', '2026-10-24', '95%', 'Email', '', ''],
  ],
  bills: [
    ['Bill ID', 'Supplier', 'Description', 'Amount', 'Due date', 'Can move to', 'Why', 'Penalty'],
    ['BILL-311', 'Biji Emas Supplies', 'Green beans', '2600', '2026-10-23', '2026-11-02', 'Supplier terms allow payment up to 2 Nov with no penalty.', '0'],
    ['BILL-312', 'TNB & Air Selangor', 'Utilities', '900', '2026-10-24', '', 'Utility bills cannot be moved.', '0'],
    ['BILL-313', 'Landlord', 'Shop lot rent', '3500', '2026-10-25', '', 'Rent is due on the 25th under the tenancy agreement.', '0'],
  ],
  orders: [
    ['Order ID', 'Supplier', 'Description', 'Amount', 'Pay date', 'Urgent', 'Can wait until'],
    ['PO-077', 'PackRight Sdn Bhd', 'Packaging (bags & labels)', '1200', '2026-10-22', 'no', '2026-10-27'],
  ],
};

/** Rows back to CSV text, the way Google's export link returns them. */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(',')).join('\n');
}
