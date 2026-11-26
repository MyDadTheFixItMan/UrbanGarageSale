import { fitFontSize, flyerQrUrl, wrapLines } from '@/lib/shareFlyer';

// Pretend every character is as wide as the font size, so text is (length × size) wide, and
// 10 wide per character at the size wrapLines is given.
const widthAt = (text) => (size) => text.length * size;
const widthOf = (text) => text.length * 10;

describe('fitFontSize', () => {
  it('keeps the largest size when the text fits', () => {
    expect(fitFontSize(widthAt('SALE'), 100, 500)).toBe(100);
  });

  it('shrinks text to fit the width', () => {
    expect(fitFontSize(widthAt('GARAGE SALE'), 100, 550)).toBe(50);
  });

  it('never goes below the smallest size', () => {
    expect(fitFontSize(widthAt('x'.repeat(1000)), 100, 100, 12)).toBe(12);
  });
});

describe('wrapLines', () => {
  it('puts as many words on each line as fit', () => {
    expect(wrapLines(widthOf, 'one two three four', 100, 3)).toEqual(['one two', 'three four']);
  });

  it('ends the last line with an ellipsis when the text runs over', () => {
    expect(wrapLines(widthOf, 'one two three four five six', 100, 2)).toEqual(['one two', 'three fou…']);
  });

  it('shortens a word too long for a line', () => {
    expect(wrapLines(widthOf, 'abcdefghijklmnop', 100, 2)).toEqual(['abcdefghi…']);
  });

  it('copes with no text', () => {
    expect(wrapLines(widthOf, '', 100, 2)).toEqual([]);
    expect(wrapLines(widthOf, undefined, 100, 2)).toEqual([]);
  });
});

describe('flyerQrUrl', () => {
  it('opens the listing, tagged as coming from the flyer', () => {
    expect(flyerQrUrl('https://www.urbangaragesales.com.au', 'abc 1')).toBe(
      'https://www.urbangaragesales.com.au/ListingDetails?id=abc+1&utm_source=flyer&utm_medium=share',
    );
  });
});
