import QRCode from 'qrcode';
import { htmlSafeListing } from '@/lib/escape';
import { POSTER_CSS } from './posterStyles';

// `sheetsAcross`: the poster is split into this many A4 sheets across and down.
const paperSizes = {
  A4: { width: 210, height: 297, name: 'A4 (210mm x 297mm)', sheetsAcross: 1 },
  A2: { width: 420, height: 594, name: 'A2 - Prints on 4 A4 sheets (tape together)', sheetsAcross: 2 },
};

// The poster is laid out at this pixel size, then scaled to fit the paper.
const POSTER_WIDTH = 2480;
const POSTER_HEIGHT = 3508;
const A4_SCALE = 0.32; // 210mm is 794 CSS pixels, so 794 / 2480
const POSTER_TEXT_WIDTH = 2180; // POSTER_WIDTH less the margins in posterStyles.js
const AVERAGE_CHAR_WIDTH = 0.62; // In ems, for bold Arial in mixed case
const CAPITALS_CHAR_WIDTH = 0.76; // In ems, for the sale type in heavy capitals
const DIALOG_CLOSE_MS = 300;
const MAX_POSTER_DAYS = 3; // MAX_SALE_DAYS in pages/createListing/listingForm.js

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

// The sale's days and hours for the poster: { days: ['Saturday 7 November', ...], time: '9am - 3pm' }.
export function formatPosterDates(listing) {
  const start = new Date(listing.start_date);
  const end = new Date(listing.end_date);
  const days = [];
  for (let offset = 0; offset < MAX_POSTER_DAYS; offset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    if (offset > 0 && !(day <= end)) break;
    days.push(day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', ''));
  }

  const startTime = formatPosterTime(listing.start_time);
  const endTime = formatPosterTime(listing.end_time);
  return { days, time: startTime && endTime ? `${startTime} - ${endTime}` : '' };
}

// The largest font size, up to maxSize, that fits the text on the given number of lines.
export function posterFontSize(text, maxSize, lines = 1, charWidth = AVERAGE_CHAR_WIDTH) {
  const fitted = Math.floor((POSTER_TEXT_WIDTH * lines) / (Math.max(text.length, 1) * charWidth));
  return Math.min(maxSize, fitted);
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
      sheets.push(`
      <div class="sheet">
        <div class="poster-container" style="transform: scale(${scale}) translate(-${x}px, -${y}px)">${posterHtml}</div>
      </div>`);
    }
  }
  return sheets.join('');
}

// Full HTML document for the poster. The listing's text is escaped here.
export function buildPosterHtml(listing, { logoUrl, qrCodeDataUrl, size = 'A4' }) {
  const safe = htmlSafeListing(listing);
  const saleType = saleTypeLabel(safe.sale_type);
  const address = safe.address || '';
  const { days, time } = formatPosterDates(safe);
  const posterHtml = `
        <img src="${logoUrl}" alt="Urban Garage Sale" class="poster-logo">
        <div class="poster-type" style="font-size: ${posterFontSize(saleType, 340, 1, CAPITALS_CHAR_WIDTH)}px">${saleType}</div>
        <div class="poster-rule"></div>
        ${days.map((day) => `<div class="poster-day">${day}</div>`).join('')}
        ${time ? `<div class="poster-time">${time}</div>` : ''}
        <div class="poster-address" style="font-size: ${posterFontSize(address, 210, 2)}px">${address}</div>
        ${safe.suburb ? `<div class="poster-suburb">${safe.suburb}</div>` : ''}
        <div class="poster-qr">
          <img src="${qrCodeDataUrl}" alt="QR code" class="poster-qr-image" />
          <div class="poster-qr-label">Scan for photos, map &amp; directions</div>
        </div>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Garage Sale Poster - ${saleType}</title>
      <style>${POSTER_CSS}</style>
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

  const posterHTML = buildPosterHtml(listing, { logoUrl: `${baseUrl}/Logo%20Webpage.png`, qrCodeDataUrl, size });

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
      printWindow.print();
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
