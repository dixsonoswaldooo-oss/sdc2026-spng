import { TH, THEAD } from './tableStyles';

/** Column titles; hidden on phones, where each cell shows its own label. */
export function TableHeader({ labels }: { labels: string[] }) {
  return (
    <thead className={THEAD}>
      <tr>
        {labels.map((label) => (
          <th key={label} scope="col" className={TH}>
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}
