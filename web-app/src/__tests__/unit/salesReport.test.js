import {
  saleDate,
  sortSalesNewestFirst,
  salesTotal,
  paymentLabel,
  buildSalesReportHtml,
} from '@/pages/urbanpay/salesReport';

const timestamp = (date) => ({ toDate: () => date });

describe('sales list helpers', () => {
  it('reads Firestore Timestamps, Dates and ISO strings', () => {
    const date = new Date(2026, 9, 9, 10, 0);
    expect(saleDate({ createdAt: timestamp(date) })).toBe(date);
    expect(saleDate({ createdAt: date }).getTime()).toBe(date.getTime());
    expect(saleDate({ createdAt: '2026-10-09T10:00:00' }).getHours()).toBe(10);
    expect(saleDate({ createdAt: 'garbage' })).toBeNull();
    expect(saleDate({})).toBeNull();
  });

  it('sorts newest first, including Firestore Timestamps, with undated sales last', () => {
    const sales = [
      { id: 'old', createdAt: timestamp(new Date(2026, 0, 1)) },
      { id: 'undated' },
      { id: 'new', createdAt: timestamp(new Date(2026, 5, 1)) },
      { id: 'middle', createdAt: '2026-03-01T00:00:00' },
    ];
    expect(sortSalesNewestFirst(sales).map((s) => s.id)).toEqual(['new', 'middle', 'old', 'undated']);
  });

  it('does not reorder the array it is given', () => {
    const sales = [{ id: 'a', createdAt: '2026-01-01' }, { id: 'b', createdAt: '2026-02-01' }];
    sortSalesNewestFirst(sales);
    expect(sales.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('totals amounts, ignoring missing or non-numeric ones', () => {
    expect(salesTotal([{ amount: 10 }, { amount: '2.5' }, {}, { amount: 'abc' }])).toBe(12.5);
    expect(salesTotal([])).toBe(0);
  });

  it('labels cash and card sales', () => {
    expect(paymentLabel({ paymentMethod: 'cash' })).toBe('💵 Cash');
    expect(paymentLabel({ paymentMethod: 'card' })).toBe('💳 Card');
  });
});

describe('buildSalesReportHtml', () => {
  const sales = [
    { paymentMethod: 'cash', amount: 20, description: '<script>alert(1)</script>', createdAt: timestamp(new Date(2026, 9, 9, 10, 0)) },
    { paymentMethod: 'card', amount: 5.5, description: 'Books' },
  ];

  it('escapes item descriptions', () => {
    const html = buildSalesReportHtml(sales, new Date(2026, 9, 9));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('shows the count, grand total and generation year', () => {
    const html = buildSalesReportHtml(sales, new Date(2027, 0, 2));
    expect(html).toContain('<div class="meta-value">2</div>');
    expect(html.match(/\$25\.50/g)).toHaveLength(2); // period revenue and grand total
    expect(html).toContain('© 2027');
    expect(html).toContain('Unknown date');
  });
});
