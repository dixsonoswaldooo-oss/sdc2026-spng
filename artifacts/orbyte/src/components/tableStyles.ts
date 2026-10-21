// One table style for every list. Wide screens: a normal table. Phones: each row becomes a card,
// and each cell shows its column name from data-label (so no second layout is needed).
export const TABLE = 'w-full text-sm';
export const THEAD = 'hidden text-left text-xs text-muted md:table-header-group';
export const TH = 'border-b border-line px-3 py-2 font-medium';
export const TR = 'block border-b border-line py-2 last:border-b-0 md:table-row md:py-0';
export const TD =
  'flex justify-between gap-4 px-3 py-1 text-right before:text-left before:text-xs before:text-muted before:content-[attr(data-label)] md:table-cell md:border-b md:border-line md:py-2.5 md:text-left md:before:content-none';
