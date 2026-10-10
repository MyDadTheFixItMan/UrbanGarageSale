import {
  saleTypeLabel,
  formatPosterTime,
  formatPosterDateTime,
  buildPosterHtml,
} from '@/utils/printGarageSaleSign';

describe('poster text', () => {
  it('labels known sale types and falls back to GARAGE SALE', () => {
    expect(saleTypeLabel('estate_sale')).toBe('ESTATE SALE');
    expect(saleTypeLabel('unknown')).toBe('GARAGE SALE');
    expect(saleTypeLabel(undefined)).toBe('GARAGE SALE');
  });

  it.each([
    ['09:00', '9am'],
    ['12:00', '12pm'],
    ['00:30', '12:30am'],
    ['14:30', '2:30pm'],
    ['', ''],
  ])('formats %p as %p', (input, expected) => {
    expect(formatPosterTime(input)).toBe(expected);
  });

  it('puts a single-day sale on one line with the time range', () => {
    const text = formatPosterDateTime({ start_date: '2026-10-10', end_date: '2026-10-10', start_time: '08:00', end_time: '13:00' });
    expect(text).toBe('Saturday, 10 October 2026, 8am - 1pm');
  });

  it('puts each day of a multi-day sale on its own line', () => {
    const text = formatPosterDateTime({ start_date: '2026-10-10', end_date: '2026-10-11', start_time: '08:00', end_time: '13:00' });
    expect(text).toBe('Saturday, 10 October 2026\nSunday, 11 October 2026, 8am - 1pm');
  });

  it('omits the time when either end is missing', () => {
    expect(formatPosterDateTime({ start_date: '2026-10-10', end_date: '2026-10-10', start_time: '08:00' }))
      .toBe('Saturday, 10 October 2026');
  });
});

describe('buildPosterHtml', () => {
  const listing = {
    id: 'sale-1',
    sale_type: 'moving_sale',
    address: '<img src=x onerror=alert(1)>',
    suburb: 'Fitzroy',
    start_date: '2026-10-10',
    end_date: '2026-10-10',
  };

  it('escapes user-supplied listing text', () => {
    const html = buildPosterHtml(listing, { posterImageUrl: '/bg.png', qrCodeDataUrl: 'data:x' });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;, Fitzroy');
  });

  it('includes the sale type, background and QR code', () => {
    const html = buildPosterHtml(listing, { posterImageUrl: '/bg.png', qrCodeDataUrl: 'data:image/png;base64,QR' });
    expect(html).toContain('<title>Garage Sale Poster - MOVING SALE</title>');
    expect(html).toContain('src="/bg.png"');
    expect(html).toContain('src="data:image/png;base64,QR"');
  });
});
