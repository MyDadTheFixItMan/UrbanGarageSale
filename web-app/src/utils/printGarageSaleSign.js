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

// Date line(s) for the poster: one line for a single-day sale, one line per day otherwise.
export function formatPosterDateTime(listing) {
  const startDate = new Date(listing.start_date);
  const endDate = new Date(listing.end_date);
  const longDate = (date) => date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const weekday = (date) => date.toLocaleDateString('en-AU', { weekday: 'long' });

  const startTime = formatPosterTime(listing.start_time);
  const endTime = formatPosterTime(listing.end_time);
  const timeSuffix = startTime && endTime ? `, ${startTime} - ${endTime}` : '';

  const startLine = `${weekday(startDate)}, ${longDate(startDate)}`;
  if (startDate.toDateString() === endDate.toDateString()) {
    return `${startLine}${timeSuffix}`;
  }
  return `${startLine}\n${weekday(endDate)}, ${longDate(endDate)}${timeSuffix}`;
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
export function buildPosterHtml(listing, { posterImageUrl, qrCodeDataUrl, size = 'A4' }) {
  const safe = htmlSafeListing(listing);
  const saleType = saleTypeLabel(safe.sale_type);
  const location = `${safe.address || ''}${safe.suburb ? ', ' + safe.suburb : ''}`;
  const posterHtml = `
        <img src="${posterImageUrl}" alt="Poster Background" class="poster-background">

        <div class="text-overlay">
          <div class="text-field text-title">${saleType}</div>
          <div class="text-field text-date">${formatPosterDateTime(safe)}</div>
          <div class="text-field text-location">${location}</div>
        </div>

        <div class="qr-code-container">
          <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-code-image" />
        </div>

        <div class="qr-label">
          Scan for full listing & directions
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
    <body>${posterSheets(posterHtml, paperSizes[size].sheetsAcross)}
    </body>
    </html>
  `;
}

/**
 * Print Listing Poster using the custom poster template
 * Uses A4 poster template: 2480x3508px @ 300 DPI
 * Includes background image, text overlays, and QR code
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
      width: 160,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    });
  } catch (err) {
    console.error('Failed to generate QR code:', err);
  }

  const posterHTML = buildPosterHtml(listing, { posterImageUrl: `${baseUrl}/poster-bg.png`, qrCodeDataUrl, size });

  // Use blob URL for better reliability with popup windows
  try {
    const blob = new Blob([posterHTML], { type: 'text/html' });
    const printWindow = window.open(URL.createObjectURL(blob), 'listing-poster-print', 'width=1200,height=1400,scrollbars=yes');

    if (!printWindow) {
      alert('Please disable popup blockers to print the poster');
      return;
    }

    printWindow.addEventListener('load', () => {
      printWindow.print();
    });
  } catch (error) {
    console.error('Error creating print window:', error);
    alert('Error opening print window. Please try again.');
  }
}

export { paperSizes };
