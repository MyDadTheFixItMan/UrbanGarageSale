import {
  SHARE_CHANNELS,
  copyText,
  emailShareUrl,
  facebookShareUrl,
  flyerFileName,
  listingPostText,
  listingShareText,
  listingShareUrl,
  openShareSheet,
  salePlace,
  saleTypeName,
  saleWhenText,
  shareSheetData,
  whatsAppShareUrl,
} from '@/lib/share';

const SITE = 'https://www.urbangaragesales.com.au';

// A seller's own listing, which has the street address that must never be shared.
const listing = {
  id: 'sale-1',
  title: 'Huge moving sale',
  sale_type: 'moving_sale',
  address: '12 Secret St',
  suburb: 'Brunswick',
  state: 'VIC',
  start_date: '2026-11-21',
  end_date: '2026-11-22',
  start_time: '08:00',
  end_time: '14:30',
};

const setNavigator = (key, value) => Object.defineProperty(navigator, key, { value, configurable: true, writable: true });

describe('listingShareUrl', () => {
  it('links to the listing page, tagged with how it was shared', () => {
    expect(listingShareUrl(SITE, 'sale-1', SHARE_CHANNELS.WHATSAPP))
      .toBe(`${SITE}/ListingDetails?id=sale-1&utm_source=whatsapp&utm_medium=share`);
  });

  it('leaves the tags off without a channel, and encodes the ID', () => {
    expect(listingShareUrl(SITE, 'a b&c')).toBe(`${SITE}/ListingDetails?id=a+b%26c`);
  });
});

describe('share text', () => {
  it('describes the sale by type, suburb and time', () => {
    expect(saleTypeName(listing)).toBe('Moving Sale');
    expect(salePlace(listing)).toBe('Brunswick VIC');
    expect(saleWhenText(listing)).toBe('Sat 21st to Sun 22nd Nov · 8am–2:30pm');
    expect(listingShareText(listing)).toBe('Moving Sale in Brunswick VIC · Sat 21st to Sun 22nd Nov · 8am–2:30pm');
  });

  it('names every sale type in a way that reads as a sentence', () => {
    expect(saleTypeName({ sale_type: 'multi_family' })).toBe('Multi-Family Sale');
    expect(saleTypeName({ sale_type: 'auction' })).toBe('Auction');
    expect(saleTypeName({})).toBe('Garage Sale');
  });

  it('gives the share sheet the title, a line about the sale and the link', () => {
    expect(shareSheetData(listing, 'https://x.test/l')).toEqual({
      title: 'Huge moving sale',
      text: 'Moving Sale in Brunswick VIC · Sat 21st to Sun 22nd Nov · 8am–2:30pm',
      url: 'https://x.test/l',
    });
  });

  it('writes a ready-made post', () => {
    expect(listingPostText(listing, 'https://x.test/l')).toBe([
      '🏷️ Moving Sale in Brunswick VIC',
      '📅 Sat 21st to Sun 22nd Nov · 8am–2:30pm',
      'Huge moving sale',
      '',
      'Photos, map and details: https://x.test/l',
    ].join('\n'));
  });

  it('copes with a listing missing its details', () => {
    expect(listingShareText({})).toBe('Garage Sale');
    expect(listingPostText({}, 'https://x.test/l')).toBe('🏷️ Garage Sale\n\nPhotos, map and details: https://x.test/l');
  });

  it('never includes the street address', () => {
    const everything = [
      listingShareText(listing),
      listingPostText(listing, SITE),
      decodeURIComponent(whatsAppShareUrl(listing, SITE)),
      decodeURIComponent(emailShareUrl(listing, SITE)),
      JSON.stringify(shareSheetData(listing, SITE)),
    ].join('\n');
    expect(everything).not.toMatch(/Secret/);
  });
});

describe('share links', () => {
  const url = 'https://x.test/ListingDetails?id=1&utm_source=facebook';

  it('opens Facebook with the link', () => {
    expect(facebookShareUrl(url)).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
  });

  it('opens WhatsApp with the title, a line about the sale and the link', () => {
    const text = new URL(whatsAppShareUrl(listing, url)).searchParams.get('text');
    expect(text).toBe(`Huge moving sale\n${listingShareText(listing)}\n${url}`);
  });

  it('opens an email with a subject and the post text', () => {
    const email = new URL(emailShareUrl(listing, url));
    expect(email.protocol).toBe('mailto:');
    expect(email.searchParams.get('subject')).toBe('Huge moving sale – Moving Sale in Brunswick VIC');
    expect(email.searchParams.get('body')).toBe(listingPostText(listing, url));
  });
});

describe('flyerFileName', () => {
  it('names the file after the sale', () => {
    expect(flyerFileName(listing)).toBe('moving-sale-brunswick.png');
    expect(flyerFileName({ suburb: "St Kilda's East" })).toBe('garage-sale-st-kilda-s-east.png');
  });
});

describe('openShareSheet', () => {
  afterEach(() => {
    delete navigator.share;
    delete navigator.canShare;
  });

  it('opens the share sheet', async () => {
    setNavigator('share', jest.fn().mockResolvedValue(undefined));
    await expect(openShareSheet({ url: 'https://x.test' })).resolves.toBe('shared');
    expect(navigator.share).toHaveBeenCalledWith({ url: 'https://x.test' });
  });

  it('tells a share the person cancelled from one the browser refused', async () => {
    setNavigator('share', jest.fn().mockRejectedValue(Object.assign(new Error('Cancelled'), { name: 'AbortError' })));
    await expect(openShareSheet({ url: 'https://x.test' })).resolves.toBe('cancelled');

    setNavigator('share', jest.fn().mockRejectedValue(Object.assign(new Error('Refused'), { name: 'NotAllowedError' })));
    await expect(openShareSheet({ url: 'https://x.test' })).resolves.toBe('unavailable');
  });

  it("is unavailable without a share sheet, or for files the device can't share", async () => {
    await expect(openShareSheet({ url: 'https://x.test' })).resolves.toBe('unavailable');

    setNavigator('share', jest.fn());
    setNavigator('canShare', jest.fn(() => false));
    await expect(openShareSheet({ files: [new File(['x'], 'flyer.png')] })).resolves.toBe('unavailable');
    expect(navigator.share).not.toHaveBeenCalled();
  });
});

describe('copyText', () => {
  afterEach(() => {
    delete navigator.clipboard;
  });

  it('copies text to the clipboard', async () => {
    setNavigator('clipboard', { writeText: jest.fn().mockResolvedValue(undefined) });
    await expect(copyText('hello')).resolves.toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
  });

  it("reports a browser that won't", async () => {
    await expect(copyText('hello')).resolves.toBe(false);

    setNavigator('clipboard', { writeText: jest.fn().mockRejectedValue(new Error('Denied')) });
    await expect(copyText('hello')).resolves.toBe(false);
  });
});
