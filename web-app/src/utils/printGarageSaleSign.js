import QRCode from 'qrcode';
import { htmlSafeListing } from '@/lib/escape';
import { POSTER_CSS } from './posterStyles';

const paperSizes = {
  A4: { width: 210, height: 297, name: 'A4 (210mm x 297mm)' },
  A1: { width: 594, height: 841, name: 'A1 - Prints on 4x A4 sheets (tape together)' },
};

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

// Full HTML document for the poster. The listing's text is escaped here.
export function buildPosterHtml(listing, { posterImageUrl, qrCodeDataUrl }) {
  const safe = htmlSafeListing(listing);
  const saleType = saleTypeLabel(safe.sale_type);
  const location = `${safe.address || ''}${safe.suburb ? ', ' + safe.suburb : ''}`;

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
      <div class="poster-container">
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
        </div>
      </div>
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
export async function printListingPoster(listing) {
  const baseUrl = window.location.origin;
  const listingUrl = `${baseUrl}/?page=ListingDetails&id=${encodeURIComponent(listing.id)}`;

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

  const posterHTML = buildPosterHtml(listing, { posterImageUrl: `${baseUrl}/poster-bg.png`, qrCodeDataUrl });

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
