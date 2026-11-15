import { waitFor } from '@testing-library/react';
import {
  saleTypeLabel,
  formatPosterTime,
  formatPosterDates,
  posterFontSize,
  saleTypeLines,
  buildPosterHtml,
  posterListingUrl,
  printAfterDialogCloses,
} from '@/utils/printGarageSaleSign';

describe('printAfterDialogCloses', () => {
  it('waits for the dialog to finish closing before opening the print window', async () => {
    jest.useFakeTimers();
    URL.createObjectURL = jest.fn(() => 'blob:poster');
    const open = jest.spyOn(window, 'open').mockReturnValue({ addEventListener: jest.fn() });
    const listing = { id: 'sale-1', start_date: '2026-10-10', end_date: '2026-10-10' };

    printAfterDialogCloses(listing, 'A4');
    expect(open).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(300);
    jest.useRealTimers();
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    open.mockRestore();
  });
});

describe('poster QR code', () => {
  it('opens the listing page itself', () => {
    expect(posterListingUrl('https://www.urbangaragesales.com.au', 'abc123'))
      .toBe('https://www.urbangaragesales.com.au/ListingDetails?id=abc123');
  });
});

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

  it('gives a single-day sale one short day and the hours', () => {
    expect(formatPosterDates({ start_date: '2026-10-10', end_date: '2026-10-10', start_time: '08:00', end_time: '13:00' }))
      .toEqual({ days: 'SAT 10 OCT', time: '8am – 1pm' });
  });

  it('puts a multi-day sale on one line', () => {
    const days = (start, end) => formatPosterDates({ start_date: start, end_date: end }).days;

    expect(days('2026-10-10', '2026-10-11')).toBe('SAT 10 & SUN 11 OCT');
    expect(days('2026-10-10', '2026-10-12')).toBe('SAT 10 – MON 12 OCT');
    expect(days('2026-10-31', '2026-11-02')).toBe('SAT 31 OCT – MON 2 NOV');
  });

  it('omits the hours when either end is missing', () => {
    expect(formatPosterDates({ start_date: '2026-10-10', end_date: '2026-10-10', start_time: '08:00' }).time).toBe('');
  });

  it('puts SALE on its own line under the sale type', () => {
    expect(saleTypeLines('MULTI-FAMILY SALE')).toEqual(['MULTI-FAMILY', 'SALE']);
    expect(saleTypeLines('AUCTION')).toEqual(['AUCTION']);
  });

  it('shrinks long text to fit and leaves short text at full size', () => {
    expect(posterFontSize('MULTI-FAMILY', 470, 1, 0.5, 1960)).toBe(326);
    expect(posterFontSize('YARD', 470, 1, 0.5, 1960)).toBe(470);
    expect(posterFontSize('1234 Long Waterfront Boulevard', 180)).toBeLessThan(130);
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
    const html = buildPosterHtml(listing, { logoUrl: '/logo.png', qrCodeDataUrl: 'data:x' });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('<div class="poster-suburb">Fitzroy</div>');
  });

  it('shows the listing title as a hook, escaped', () => {
    const html = buildPosterHtml({ ...listing, title: 'Tools & toys <b>' }, { logoUrl: '/logo.png', qrCodeDataUrl: 'data:x' });
    expect(html).toContain('<div class="poster-hook">Tools &amp; toys &lt;b&gt;</div>');
    expect(buildPosterHtml(listing, { logoUrl: '/logo.png', qrCodeDataUrl: 'data:x' })).not.toContain('poster-hook"');
  });

  it('loads its fonts from the given address', () => {
    const html = buildPosterHtml(listing, { logoUrl: '/logo.png', qrCodeDataUrl: 'data:x', fontsUrl: 'https://example.com/fonts' });
    expect(html).toContain("url('https://example.com/fonts/anton-latin.woff2')");
    expect(html).toContain("url('https://example.com/fonts/archivo-latin.woff2')");
  });

  it('includes the sale type, logo and QR code', () => {
    const html = buildPosterHtml(listing, { logoUrl: '/logo.png', qrCodeDataUrl: 'data:image/png;base64,QR' });
    expect(html).toContain('<title>Garage Sale Poster - MOVING SALE</title>');
    expect(html).toContain('src="/logo.png"');
    expect(html).toContain('src="data:image/png;base64,QR"');
  });

  it('keeps the rows off the join only on a multi-sheet poster', () => {
    const html = (size) => buildPosterHtml(listing, { logoUrl: '/logo.png', qrCodeDataUrl: 'data:x', size });

    expect(html('A4')).not.toContain('class="poster-container poster-tiled"');
    expect(html('A2')).toContain('class="poster-container poster-tiled"');
  });

  it('shifts side-by-side sheets so the join stays inside what a printer can reach', () => {
    const html = buildPosterHtml(listing, { logoUrl: '/logo.png', qrCodeDataUrl: 'data:x', size: 'A2' });
    const shifts = [...html.matchAll(/translateX\((-?\d+)mm\)/g)].map((match) => Number(match[1]));

    expect(shifts).toEqual([-9, 9, -9, 9]);
  });

  it('marks the join on the sheets either side of it', () => {
    const marks = (size) => buildPosterHtml(listing, { logoUrl: '/logo.png', qrCodeDataUrl: 'data:x', size })
      .match(/<div class="join-mark /g)?.length ?? 0;

    expect(marks('A2')).toBe(8);
    expect(marks('A4')).toBe(0);
  });

  it('labels the mark to fold on the right-hand sheet and the mark to join to on the left', () => {
    const html = buildPosterHtml(listing, { logoUrl: '/logo.png', qrCodeDataUrl: 'data:x', size: 'A2' });

    expect(html).toMatch(/\.join-mark-left::before \{[^}]*content: 'Fold'/);
    expect(html).toMatch(/\.join-mark-right::before \{[^}]*content: 'Join'/);
  });

  it('stops the browser splitting a sheet across pages when printing', () => {
    const html = buildPosterHtml(listing, { logoUrl: '/logo.png', qrCodeDataUrl: 'data:x', size: 'A2' });

    expect(html).toMatch(/\.sheet \{[^}]*contain: strict/);
  });

  it('prints A4 on one sheet and A2 across four', () => {
    const sheets = (size) => buildPosterHtml(listing, { logoUrl: '/logo.png', qrCodeDataUrl: 'data:x', size })
      .match(/class="sheet"/g).length;
    expect(sheets('A4')).toBe(1);
    expect(sheets('A2')).toBe(4);
  });
});
