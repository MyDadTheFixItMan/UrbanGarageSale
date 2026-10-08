import { escapeHtml, htmlSafeListing } from '@/lib/escape';

describe('HTML escaping for printable listings', () => {
  it('neutralises script and attribute injection', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(escapeHtml("' & ")).toBe('&#39; &amp; ');
  });

  it('handles null and numbers', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });

  it('escapes every string field of a listing and URL-encodes the id', () => {
    const safe = htmlSafeListing({
      id: 'abc"&x=1',
      address: '<script>steal()</script>',
      suburb: 'Fitzroy',
      latitude: -37.8,
      photos: ['a.jpg'],
    });
    expect(safe.address).toBe('&lt;script&gt;steal()&lt;/script&gt;');
    expect(safe.suburb).toBe('Fitzroy');
    expect(safe.latitude).toBe(-37.8);
    expect(safe.photos).toEqual(['a.jpg']);
    expect(safe.id).toBe('abc%22%26x%3D1');
  });

  it('leaves ISO dates intact so they still parse', () => {
    expect(htmlSafeListing({ start_date: '2026-10-10' }).start_date).toBe('2026-10-10');
  });
});
