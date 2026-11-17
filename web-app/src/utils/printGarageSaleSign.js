import QRCode from 'qrcode';
import { escapeHtml, htmlSafeListing } from '@/lib/escape';
import { POSTER_CSS } from './posterStyles';

// `sheetsAcross`: the poster is split into this many A4 sheets across and down.
const paperSizes = {
  A4: { width: 210, height: 297, name: 'A4 (210mm x 297mm)', sheetsAcross: 1 },
  A2: {
    width: 420,
    height: 594,
    name: 'A2 - Prints on 4 A4 sheets (fold and tape)',
    sheetsAcross: 2,
    note: 'Print at 100% (Actual size). Fold the left edge of each right-hand sheet back along its Fold marks, lay the fold on the Join marks of the sheet to its left, then tape.',
  },
};

// The poster is laid out at this pixel size, then scaled to fit the paper.
const POSTER_WIDTH = 2480;
const POSTER_HEIGHT = 3508;
const A4_SCALE = 0.32; // 210mm is 794 CSS pixels, so 794 / 2480
const POSTER_TEXT_WIDTH = 2180; // POSTER_WIDTH less the margins in posterStyles.js
const BAND_TEXT_WIDTH = 1960; // POSTER_TEXT_WIDTH less the orange band's padding
// Widest average letter, in ems, measured in each font with a little to spare.
const ADDRESS_CHAR_WIDTH = 0.58; // Heavy Archivo in mixed case
const DISPLAY_CHAR_WIDTH = 0.5; // Anton capitals
const DAYS_CHAR_WIDTH = 0.45; // Anton capitals, digits and spaces
const DIALOG_CLOSE_MS = 300;
const MAX_POSTER_DAYS = 3; // MAX_SALE_DAYS in pages/createListing/listingForm.js
// The poster's fonts, served from public/fonts. The print waits this long at most for them.
const POSTER_FONTS = ['400 100px Anton', '600 100px Archivo', '800 100px Archivo'];
const FONT_WAIT_MS = 4000;
// Printers can't reach the edge of the paper, so sheets simply butted together lose letters at
// the join. Side-by-side sheets move the join this far in from the paper's edge, onto the printed
// area, and the right-hand sheet's spare edge is folded under. The marks in posterStyles.js show
// where, at the same distance.
const JOIN_INSET_MM = 9;

const SALE_TYPE_LABELS = {
  garage_sale: 'GARAGE SALE',
  yard_sale: 'YARD SALE',
  estate_sale: 'ESTATE SALE',
  moving_sale: 'MOVING SALE',
  multi_family: 'MULTI-FAMILY SALE',
  clearing_sale: 'CLEARING SALE',
  auction: 'AUCTION',
  street_sale: 'STREET SALE',
};

export function saleTypeLabel(saleType) {
  return SALE_TYPE_LABELS[saleType] || 'GARAGE SALE';
}

// "14:30" -> "2:30pm", "09:00" -> "9am".
export function formatPosterTime(time) {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const displayHour = hour % 12 || 12;
  return `${displayHour}${minutes !== '00' ? ':' + minutes : ''}${ampm}`;
}

// "SAT 7", or "SAT 7 NOV" with the month.
function shortPosterDay(day, withMonth) {
  const parts = [day.toLocaleDateString('en-AU', { weekday: 'short' }), day.getDate()];
  if (withMonth) parts.push(day.toLocaleDateString('en-AU', { month: 'short' }));
  return parts.join(' ').replace(/\./g, '').toUpperCase();
}

// The sale's days and hours for the poster, each on one line:
// { days: 'SAT 7 NOV' | 'SAT 7 & SUN 8 NOV' | 'SAT 31 OCT – MON 2 NOV', time: '9am – 3pm' }.
export function formatPosterDates(listing) {
  const start = new Date(listing.start_date);
  const end = new Date(listing.end_date);
  const dates = [];
  for (let offset = 0; offset < MAX_POSTER_DAYS; offset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    if (offset > 0 && !(day <= end)) break;
    dates.push(day);
  }

  const first = dates[0];
  const last = dates[dates.length - 1];
  const days = dates.length === 1
    ? shortPosterDay(first, true)
    : `${shortPosterDay(first, first.getMonth() !== last.getMonth())}${dates.length === 2 ? ' & ' : ' – '}${shortPosterDay(last, true)}`;

  const startTime = formatPosterTime(listing.start_time);
  const endTime = formatPosterTime(listing.end_time);
  return { days, time: startTime && endTime ? `${startTime} – ${endTime}` : '' };
}

// The sale type in the orange band, with "SALE" on a line of its own: 'MULTI-FAMILY SALE' ->
// ['MULTI-FAMILY', 'SALE'], 'AUCTION' -> ['AUCTION'].
export function saleTypeLines(label) {
  const match = label.match(/^(.+) SALE$/);
  return match ? [match[1], 'SALE'] : [label];
}

// The largest font size, up to maxSize, that fits the text on the given number of lines.
export function posterFontSize(text, maxSize, lines = 1, charWidth = ADDRESS_CHAR_WIDTH, width = POSTER_TEXT_WIDTH) {
  const fitted = Math.floor((width * lines) / (Math.max(text.length, 1) * charWidth));
  return Math.min(maxSize, fitted);
}

// The poster's fonts, from the site itself: the poster is a blob: page, so it needs full addresses.
function posterFontFaces(fontsUrl) {
  return `
@font-face { font-family: Anton; font-weight: 400; src: url('${fontsUrl}/anton-latin.woff2') format('woff2'); }
@font-face { font-family: Archivo; font-weight: 100 900; src: url('${fontsUrl}/archivo-latin.woff2') format('woff2'); }`;
}

// The sheets are hidden on screen, so the browser doesn't fetch their fonts until it prints, and
// prints in the fallback fonts. Fetch them first, but print anyway if they are slow or fail.
function posterFontsReady(doc) {
  if (!doc.fonts) return Promise.resolve();
  const loads = Promise.all(POSTER_FONTS.map((font) => doc.fonts.load(font).catch(() => {})));
  return Promise.race([loads, new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS))]);
}

// One A4 sheet per section of the poster: each is the whole poster, scaled and moved so that only
// its section lands on the paper.
function posterSheets(posterHtml, sheetsAcross) {
  const scale = A4_SCALE * sheetsAcross;
  const sheets = [];
  for (let row = 0; row < sheetsAcross; row += 1) {
    for (let column = 0; column < sheetsAcross; column += 1) {
      const x = (column * POSTER_WIDTH) / sheetsAcross;
      const y = (row * POSTER_HEIGHT) / sheetsAcross;
      const joinShift = (2 * column - (sheetsAcross - 1)) * JOIN_INSET_MM;
      const joinMarks = [column > 0 && 'left', column < sheetsAcross - 1 && 'right'].filter(Boolean).map((side) => `
        <div class="join-mark join-mark-${side} join-mark-top"></div>
        <div class="join-mark join-mark-${side} join-mark-bottom"></div>`).join('');
      sheets.push(`
      <div class="sheet">
        <div class="poster-container${sheetsAcross > 1 ? ' poster-tiled' : ''}" style="transform: translateX(${joinShift}mm) scale(${scale}) translate(-${x}px, -${y}px)">${posterHtml}</div>${joinMarks}
      </div>`);
    }
  }
  return sheets.join('');
}

// Full HTML document for the poster. The listing's text is escaped here.
export function buildPosterHtml(listing, { logoUrl, qrCodeDataUrl, fontsUrl = '/fonts', size = 'A4' }) {
  const safe = htmlSafeListing(listing);
  const saleType = saleTypeLabel(safe.sale_type);
  const address = safe.address || '';
  const { days, time } = formatPosterDates(safe);
  const posterHtml = `
        <div class="poster-section poster-top">
          <div class="poster-band">
            ${saleTypeLines(saleType).map((line) => `<div class="poster-type" style="font-size: ${posterFontSize(line, 470, 1, DISPLAY_CHAR_WIDTH, BAND_TEXT_WIDTH)}px">${line}</div>`).join('')}
          </div>
          <div class="poster-days" style="font-size: ${posterFontSize(days, 280, 1, DAYS_CHAR_WIDTH)}px">${escapeHtml(days)}</div>
          ${time ? `<div class="poster-time">${time}</div>` : ''}
        </div>
        <div class="poster-section poster-bottom">
          <div class="poster-address" style="font-size: ${posterFontSize(address, 180)}px">${address}</div>
          ${safe.suburb ? `<div class="poster-suburb">${safe.suburb}</div>` : ''}
          ${safe.title ? `<div class="poster-hook">${safe.title}</div>` : ''}
          <div class="poster-foot">
            <div class="poster-qr"><img src="${qrCodeDataUrl}" alt="QR code" class="poster-qr-image" /></div>
            <div class="poster-cta">
              <div class="poster-cta-head">Scan to see<br>what&rsquo;s for sale</div>
              <div class="poster-cta-sub">Photos, map &amp; directions</div>
              <div class="poster-brand">
                <img src="${logoUrl}" alt="Urban Garage Sales" class="poster-logo">
                <div>Find more sales near you<b>urbangaragesales.com.au</b></div>
              </div>
            </div>
          </div>
        </div>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Garage Sale Poster - ${saleType}</title>
      <style>${posterFontFaces(fontsUrl)}${POSTER_CSS}</style>
    </head>
    <body>
      <p class="print-note">Printing your sign. This window closes when you finish.</p>${posterSheets(posterHtml, paperSizes[size].sheetsAcross)}
    </body>
    </html>
  `;
}

/**
 * Print Listing Poster
 * Laid out at A4, 2480x3508px @ 300 DPI, with the logo, sale details and QR code
 * Opens in a separate print window to avoid affecting the main page
 */
// The address the poster's QR code opens: the listing's own page.
export function posterListingUrl(baseUrl, listingId) {
  return `${baseUrl}/ListingDetails?id=${encodeURIComponent(listingId)}`;
}

export async function printListingPoster(listing, size = 'A4') {
  const baseUrl = window.location.origin;
  const listingUrl = posterListingUrl(baseUrl, listing.id);

  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(listingUrl, {
      width: 760,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    });
  } catch (err) {
    console.error('Failed to generate QR code:', err);
  }

  const posterHTML = buildPosterHtml(listing, {
    logoUrl: `${baseUrl}/logo-header.webp`,
    qrCodeDataUrl,
    fontsUrl: `${baseUrl}/fonts`,
    size,
  });

  // Use blob URL for better reliability with popup windows
  try {
    const blob = new Blob([posterHTML], { type: 'text/html' });
    const printWindow = window.open(URL.createObjectURL(blob), 'listing-poster-print', 'width=1200,height=1400,scrollbars=yes');

    if (!printWindow) {
      alert('Please disable popup blockers to print the poster');
      return;
    }

    printWindow.addEventListener('afterprint', () => printWindow.close());
    printWindow.addEventListener('load', () => {
      posterFontsReady(printWindow.document).then(() => printWindow.print());
    });
  } catch (error) {
    console.error('Error creating print window:', error);
    alert('Error opening print window. Please try again.');
  }
}

// Print from a dialog that is closing. The print window pauses this page, and a dialog paused
// mid-animation never finishes closing, so it stays on screen and can't be dismissed. Wait out
// the animation first (200ms, in components/ui/dialog.jsx).
export function printAfterDialogCloses(listing, size) {
  setTimeout(() => printListingPoster(listing, size), DIALOG_CLOSE_MS);
}

export { paperSizes };
