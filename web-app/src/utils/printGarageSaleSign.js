import QRCode from 'qrcode';

const paperSizes = {
  A4: { width: 210, height: 297, name: 'A4 (210mm x 297mm)' },
  A1: { width: 594, height: 841, name: 'A1 - Prints on 4x A4 sheets (tape together)' },
};

/**
 * Print A1 size sign on 4x A4 sheets (2x2 grid)
 * Includes crop marks and taping instructions
 */
async function printGarageSaleSignAs4A4Pages(listing) {
  // Format the sale type label
  const saleTypeLabels = {
    garage_sale: 'GARAGE SALE',
    yard_sale: 'YARD SALE',
    estate_sale: 'ESTATE SALE',
    moving_sale: 'MOVING SALE',
    multi_family: 'MULTI-FAMILY SALE',
    clearing_sale: 'CLEARING SALE',
    auction: 'AUCTION',
    street_sale: 'STREET SALE',
  };
  const saleTypeDisplay = saleTypeLabels[listing.sale_type] || 'GARAGE SALE';

  // Format date and time
  const startDate = new Date(listing.start_date);
  const endDate = new Date(listing.end_date);
  const dateStr = startDate.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Generate the listing URL
  const baseUrl = window.location.origin;
  const listingUrl = `${baseUrl}/?page=ListingDetails&id=${listing.id}`;

  // Generate QR code
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(listingUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Failed to generate QR code:', err);
  }

  // Create print container
  let printContainer = document.getElementById('garage-sale-print-container');
  if (!printContainer) {
    printContainer = document.createElement('div');
    printContainer.id = 'garage-sale-print-container';
    document.body.appendChild(printContainer);
  }

  // Generate HTML for 4 A4 pages in 2x2 grid
  const pagePositions = [
    { row: 0, col: 0, label: '1/4 (Top-Left)' },
    { row: 0, col: 1, label: '2/4 (Top-Right)' },
    { row: 1, col: 0, label: '3/4 (Bottom-Left)' },
    { row: 1, col: 1, label: '4/4 (Bottom-Right)' }
  ];

  let pagesHTML = '';

  for (const position of pagePositions) {
    const { row, col, label } = position;
    // Calculate offset for each page (50% of A1 per page)
    const offsetX = col * 50;
    const offsetY = row * 50;

    pagesHTML += `
      <div class="a4-page">
        <div class="page-position-label">Sheet ${label}</div>
        
        <div class="sign-wrapper" style="transform: translate(-${offsetX}%, -${offsetY}%);">
          <div class="garage-sale-sign">
            <div class="garage-sale-header">
              <svg class="garage-sale-logo-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <rect x="12" y="30" width="32" height="45" fill="#f97316" rx="2"/>
                  <polygon points="12,30 28,8 44,30" fill="#f97316"/>
                  <rect x="18" y="42" width="7" height="9" fill="white" rx="1"/>
                  <rect x="28" y="42" width="7" height="9" fill="white" rx="1"/>
                  <rect x="12" y="58" width="32" height="14" fill="white" rx="1"/>
                  <rect x="68" y="30" width="20" height="50" fill="white" rx="2"/>
                  <circle cx="78" cy="40" r="3" fill="#f97316"/>
                  <circle cx="78" cy="70" r="3" fill="#f97316"/>
                  <line x1="40" y1="32" x2="62" y2="32" stroke="#f97316" stroke-width="2"/>
                  <line x1="40" y1="37" x2="62" y2="37" stroke="#f97316" stroke-width="2"/>
                  <line x1="40" y1="42" x2="62" y2="42" stroke="#f97316" stroke-width="2"/>
                </g>
              </svg>
            </div>

            <div class="garage-sale-content">
              <h1 class="garage-sale-title">${saleTypeDisplay}</h1>
              <p class="garage-sale-address">${listing.address || ''}<br/>${listing.suburb ? listing.suburb : ''}</p>
              
              <div class="garage-sale-datetime">
                <p class="garage-sale-date">${dateStr}</p>
                ${listing.start_time && listing.end_time ? `
                  <p class="garage-sale-time">${listing.start_time} - ${listing.end_time}</p>
                ` : ''}
              </div>
            </div>

            <div class="garage-sale-footer">
              <div class="garage-sale-qr">
                <img src="${qrCodeDataUrl}" alt="QR Code" class="garage-sale-qr-img" />
                <p class="garage-sale-scan-text">Scan for full listing</p>
              </div>
              <div class="garage-sale-branding-footer">
                <p class="garage-sale-website">urbangarageSale.com.au</p>
              </div>
            </div>
          </div>
        </div>

        <div class="crop-marks">
          <div class="crop-mark crop-tl"></div>
          <div class="crop-mark crop-tr"></div>
          <div class="crop-mark crop-bl"></div>
          <div class="crop-mark crop-br"></div>
        </div>

        <div class="page-break-instruction">
          ${col === 1 ? '<div class="tape-line">← TAPE HERE →</div>' : ''}
          ${row === 0 ? '<div class="tape-line-h">↑ TAPE HERE ↑</div>' : ''}
        </div>
      </div>
    `;
  }

  printContainer.innerHTML = `
    <style id="garage-sale-print-style">
      @media print {
        body * {
          visibility: hidden;
        }

        #garage-sale-print-container, #garage-sale-print-container * {
          visibility: visible;
        }

        @page {
          size: A4;
          margin: 5mm;
        }

        .a4-page {
          width: 210mm;
          height: 297mm;
          position: relative;
          overflow: hidden;
          page-break-after: always;
          margin: 0;
          padding: 0;
          background: white;
        }

        .sign-wrapper {
          width: 594mm;
          height: 841mm;
          position: absolute;
          top: 0;
          left: 0;
        }

        .garage-sale-sign {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 40mm;
          box-sizing: border-box;
          background: #2a2a2a;
          color: white;
          font-family: Arial, sans-serif;
          margin: 0;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
          gap: 10mm;
        }

        .garage-sale-header {
          text-align: center;
          margin-bottom: 20mm;
        }

        .garage-sale-logo-svg {
          width: 60mm;
          height: 60mm;
          margin: 0 auto;
        }

        .garage-sale-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 16mm;
          min-height: 150mm;
        }

        .garage-sale-title {
          font-size: 88px;
          font-weight: 900;
          color: #ffeb3b;
          text-align: center;
          margin: 0;
          line-height: 1;
          text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.8);
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        .garage-sale-address {
          font-size: 44px;
          font-weight: 900;
          color: #f97316;
          text-align: center;
          margin: 0;
          line-height: 1.3;
          word-break: break-word;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        .garage-sale-datetime {
          text-align: center;
        }

        .garage-sale-date,
        .garage-sale-time {
          font-size: 40px;
          font-weight: 700;
          color: #ffeb3b;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
          margin: 0;
          line-height: 1.4;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        .garage-sale-footer {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 14mm;
          margin-top: 16mm;
          padding-top: 14mm;
        }

        .garage-sale-qr {
          flex-shrink: 0;
        }

        .garage-sale-qr-img {
          width: 100mm;
          height: 100mm;
          background: white;
          padding: 2mm;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        .garage-sale-scan-text {
          font-size: 24px;
          color: #ccc;
          text-align: center;
          margin-top: 2mm;
          font-weight: 600;
        }

        .garage-sale-branding-footer {
          flex: 1;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .garage-sale-website {
          font-size: 32px;
          color: #f97316;
          font-weight: 900;
          margin: 0;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        .crop-marks {
          position: absolute;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .crop-mark {
          position: absolute;
          width: 10mm;
          height: 10mm;
          border: 1px solid #666;
        }

        .crop-tl { top: 2mm; left: 2mm; border-right: none; border-bottom: none; }
        .crop-tr { top: 2mm; right: 2mm; border-left: none; border-bottom: none; }
        .crop-bl { bottom: 2mm; left: 2mm; border-right: none; border-top: none; }
        .crop-br { bottom: 2mm; right: 2mm; border-left: none; border-top: none; }

        .page-position-label {
          position: absolute;
          top: 5mm;
          right: 8mm;
          font-size: 10px;
          color: #999;
          font-family: Arial, sans-serif;
        }

        .tape-line {
          position: absolute;
          right: -5mm;
          top: 50%;
          transform: translateY(-50%);
          font-size: 12px;
          color: #999;
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }

        .tape-line-h {
          position: absolute;
          bottom: -5mm;
          left: 50%;
          transform: translateX(-50%);
          font-size: 12px;
          color: #999;
        }
      }

      @media screen {
        .a4-page {
          width: 210mm;
          height: 297mm;
          position: relative;
          overflow: hidden;
          margin: 10mm auto;
          page-break-after: always;
          background: white;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }

        .sign-wrapper {
          width: 594mm;
          height: 841mm;
          position: absolute;
          top: 0;
          left: 0;
          transform-origin: top left;
          transform: scale(0.35);
        }
      }
    </style>

    ${pagesHTML}
  `;

  // Trigger print after a short delay
  setTimeout(() => {
    window.print();
  }, 200);
}


export function printGarageSaleSign(listing, selectedSize = 'A4') {
  const paperSize = paperSizes[selectedSize];

  // If A1 is selected, print on 4x A4 pages (2x2 grid)
  if (selectedSize === 'A1') {
    printGarageSaleSignAs4A4Pages(listing);
    return;
  }

  // Format the sale type label
  const saleTypeLabels = {
    garage_sale: 'GARAGE SALE',
    yard_sale: 'YARD SALE',
    estate_sale: 'ESTATE SALE',
    moving_sale: 'MOVING SALE',
    multi_family: 'MULTI-FAMILY SALE',
    clearing_sale: 'CLEARING SALE',
    auction: 'AUCTION',
    street_sale: 'STREET SALE',
  };
  const saleTypeDisplay = saleTypeLabels[listing.sale_type] || 'GARAGE SALE';

  // Format date and time
  const startDate = new Date(listing.start_date);
  const endDate = new Date(listing.end_date);
  const dateStr = startDate.toLocaleDateString('en-AU', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short',
    year: 'numeric'
  });
  const endDateStr = endDate.toLocaleDateString('en-AU', { 
    day: 'numeric', 
    month: 'short',
    year: 'numeric'
  });

  // Generate the listing URL
  const baseUrl = window.location.origin;
  const listingUrl = `${baseUrl}/?page=ListingDetails&id=${listing.id}`;

  // Create or get print container
  let printContainer = document.getElementById('garage-sale-print-container');
  if (!printContainer) {
    printContainer = document.createElement('div');
    printContainer.id = 'garage-sale-print-container';
    document.body.appendChild(printContainer);
  }

  // Inject the HTML with inline styles
  printContainer.innerHTML = `
    <style id="garage-sale-print-style">
      @media print {
        body * {
          visibility: hidden;
        }

        #garage-sale-print-container, #garage-sale-print-container * {
          visibility: visible;
        }

        #garage-sale-print-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
        }

        @page {
          size: ${paperSize.width}mm ${paperSize.height}mm;
          margin: 0;
        }

        .garage-sale-sign {
          width: 100%;
          height: auto;
          display: flex;
          flex-direction: column;
          padding: 15mm;
          box-sizing: border-box;
          background: #2a2a2a;
          color: white;
          font-family: Arial, sans-serif;
          margin: 0;
          page-break-after: avoid;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
          gap: 4mm;
        }

        .garage-sale-header {
          text-align: center;
          margin-bottom: 8mm;
        }

        .garage-sale-logo-svg {
          width: 30mm;
          height: auto;
          margin-bottom: 3mm;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        .garage-sale-branding {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3mm;
        }

        .garage-sale-urban {
          font-size: 20px;
          font-weight: 900;
          color: #f97316;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        .garage-sale-title {
          font-size: 18px;
          font-weight: 900;
          color: #009fdf;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        .garage-sale-white-section {
          background: white;
          color: #2a2a2a;
          padding: 6mm 0;
          margin: 8mm 0;
          text-align: center;
          border-top: 2px solid #ddd;
          border-bottom: 2px solid #ddd;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        .garage-sale-type {
          font-size: 36px;
          font-weight: 900;
          color: white;
          text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.8);
          background: linear-gradient(135deg, #1a1a1a 0%, #444 100%);
          margin: 0;
          padding: 4mm;
          letter-spacing: 2px;
          text-align: center;
          line-height: 1.2;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        .garage-sale-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 6mm;
          min-height: 60mm;
        }

        .garage-sale-address {
          font-size: 18px;
          font-weight: 900;
          color: #f97316;
          text-align: center;
          margin: 0;
          line-height: 1.3;
          word-break: break-word;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        .garage-sale-datetime {
          text-align: center;
        }

        .garage-sale-date,
        .garage-sale-time {
          font-size: 16px;
          font-weight: 700;
          color: #ffeb3b;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
          margin: 0;
          line-height: 1.4;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        .garage-sale-footer {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 5mm;
          margin-top: 6mm;
          padding-top: 6mm;
        }

        .garage-sale-qr {
          flex-shrink: 0;
        }

        .garage-sale-qr-img {
          width: 45mm;
          height: 45mm;
          background: white;
          padding: 2mm;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        .garage-sale-scan-text {
          font-size: 12px;
          color: #ccc;
          text-align: center;
          margin-top: 2mm;
          font-weight: 600;
        }

        .garage-sale-branding-footer {
          flex: 1;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .garage-sale-website {
          font-size: ${selectedSize === 'A4' ? '14px' : selectedSize === 'A3' ? '20px' : selectedSize === 'A2' ? '26px' : '32px'};
          color: #f97316;
          font-weight: 900;
          margin: 0;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }
      }
    </style>

    <div class="garage-sale-sign">
      <div class="garage-sale-header">
        <svg class="garage-sale-logo-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <g>
            <rect x="12" y="30" width="32" height="45" fill="#f97316" rx="2"/>
            <polygon points="12,30 28,8 44,30" fill="#f97316"/>
            <rect x="18" y="42" width="7" height="9" fill="white" rx="1"/>
            <rect x="33" y="42" width="7" height="9" fill="white" rx="1"/>
            <rect x="18" y="58" width="7" height="9" fill="white" rx="1"/>
            <rect x="33" y="58" width="7" height="9" fill="white" rx="1"/>
            <rect x="56" y="30" width="32" height="45" fill="#0d9488" rx="2"/>
            <polygon points="56,30 72,8 88,30" fill="#0d9488"/>
            <rect x="62" y="42" width="7" height="9" fill="white" rx="1"/>
            <rect x="77" y="42" width="7" height="9" fill="white" rx="1"/>
            <rect x="62" y="58" width="7" height="9" fill="white" rx="1"/>
            <rect x="77" y="58" width="7" height="9" fill="white" rx="1"/>
          </g>
        </svg>
        <div class="garage-sale-branding">
          <div class="garage-sale-urban">Urban</div>
          <div class="garage-sale-title">GARAGE SALE</div>
        </div>
      </div>

      <div class="garage-sale-white-section">
        <h1 class="garage-sale-type">${saleTypeDisplay}</h1>
      </div>

      <div class="garage-sale-content">
        <h2 class="garage-sale-address">${listing.address || 'Address not provided'}${listing.suburb ? ', ' + listing.suburb : ''}</h2>
        <div class="garage-sale-datetime">
          <p class="garage-sale-date">${dateStr}${listing.start_date !== listing.end_date ? ' - ' + endDateStr : ''}</p>
          <p class="garage-sale-time">${listing.start_time || '9:00 AM'} - ${listing.end_time || '5:00 PM'}</p>
        </div>
      </div>

      <div class="garage-sale-footer">
        <div class="garage-sale-qr">
          <canvas id="garage-sale-qr-canvas" class="garage-sale-qr-img"></canvas>
          <p class="garage-sale-scan-text">Scan for full listing</p>
        </div>
        <div class="garage-sale-branding-footer">
          <p class="garage-sale-website">urbangarageSale.com.au</p>
        </div>
      </div>
    </div>
  `;

  // Wait for DOM to update before generating QR code
  setTimeout(async () => {
    const qrCanvas = document.getElementById('garage-sale-qr-canvas');
    console.log('QR Canvas found:', !!qrCanvas);
    
    if (!qrCanvas) {
      console.error('QR canvas element not found');
      window.print();
      return;
    }

    try {
      console.log('Generating QR code to canvas...');
      // Use the qrcode npm package to generate QR code to canvas
      await QRCode.toCanvas(qrCanvas, listingUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      });
      console.log('QR code generated successfully');
      setTimeout(() => {
        window.print();
      }, 300);
    } catch (err) {
      console.error('QR code generation error:', err);
      window.print();
    }
  }, 100);
}

/**
 * Print Listing Poster using the custom poster template
 * Uses A4 poster template: 2480x3508px @ 300 DPI
 * Includes background image, text overlays, and QR code
 * Opens in a separate print window to avoid affecting the main page
 */
export async function printListingPoster(listing) {
  // Format the sale dates and times
  const startDate = new Date(listing.start_date);
  const endDate = new Date(listing.end_date);
  
  const startDayOfWeek = startDate.toLocaleDateString('en-AU', { weekday: 'long' });
  const startDateStr = startDate.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const endDayOfWeek = endDate.toLocaleDateString('en-AU', { weekday: 'long' });
  const endDateStr = endDate.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  // Format times - convert from 24hr to 12hr format
  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour % 12 || 12;
    return `${displayHour}${minutes !== '00' ? ':' + minutes : ''}${ampm}`;
  };
  
  const startTime = formatTime(listing.start_time);
  const endTime = formatTime(listing.end_time);
  const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : '';
  
  // Check if dates are different
  const isSameDay = startDate.toDateString() === endDate.toDateString();
  let formattedDateTime;
  
  if (isSameDay) {
    // Single day sale
    formattedDateTime = `${startDayOfWeek}, ${startDateStr}${timeRange ? ', ' + timeRange : ''}`;
  } else {
    // Multi-day sale - show each day on separate line
    formattedDateTime = `${startDayOfWeek}, ${startDateStr}\n${endDayOfWeek}, ${endDateStr}${timeRange ? ', ' + timeRange : ''}`;
  }

  // Map sale type to display label
  const saleTypeLabels = {
    garage_sale: 'GARAGE SALE',
    yard_sale: 'YARD SALE',
    estate_sale: 'ESTATE SALE',
    moving_sale: 'MOVING SALE',
    multi_family: 'MULTI-FAMILY SALE',
    clearing_sale: 'CLEARING SALE',
    auction: 'AUCTION',
    street_sale: 'STREET SALE',
  };
  const saleTypeDisplay = saleTypeLabels[listing.sale_type] || 'GARAGE SALE';

  // Generate the listing URL for QR code
  const baseUrl = window.location.origin;
  const listingUrl = `${baseUrl}/?page=ListingDetails&id=${listing.id}`;
  const posterImageUrl = `${baseUrl}/poster-bg.png`;

  // Generate QR code as data URL
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
    console.log('✓ QR code generated as data URL');
  } catch (err) {
    console.error('Failed to generate QR code:', err);
  }

  // Create the HTML document for printing
  const posterHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Garage Sale Poster - ${saleTypeDisplay}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html, body {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
          font-family: Arial, sans-serif;
        }

        .poster-container {
          position: relative;
          width: 2480px;
          height: 3508px;
          background-color: white;
          overflow: visible;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .poster-background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
          object-fit: cover;
          display: block;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .text-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 100;
          pointer-events: none;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .text-field {
          position: absolute;
          white-space: normal;
          overflow: visible;
          word-wrap: break-word;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .text-title {
          top: 700px;
          left: 50%;
          transform: translateX(-50%);
          width: 2200px;
          height: auto;
          min-height: 150px;
          padding: 40px 0;
          font-size: 100px;
          font-weight: 700;
          color: #000000;
          line-height: 1;
          text-align: center;
          font-family: Arial, sans-serif;
          text-shadow: 2px 2px 4px rgba(255, 255, 255, 0.8);
          display: block;
          border-bottom: 4px solid #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .text-location {
          top: 900px;
          left: 50%;
          transform: translateX(-50%);
          width: 2000px;
          height: auto;
          min-height: 140px;
          padding: 40px 0;
          font-size: 64px;
          font-weight: 700;
          color: #ff9500;
          line-height: 1.2;
          text-align: center;
          font-family: Arial, sans-serif;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
          display: block;
          border-top: 4px solid #ff9500;
          border-bottom: 4px solid #ff9500;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .text-date {
          top: 1130px;
          left: 50%;
          transform: translateX(-50%);
          width: 2200px;
          height: auto;
          min-height: 140px;
          padding: 30px 0;
          font-size: 56px;
          font-weight: 700;
          color: #ffff00;
          line-height: 1.4;
          text-align: center;
          font-family: Arial, sans-serif;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
          display: block;
          white-space: pre-wrap;
          word-wrap: break-word;
          border-top: 4px solid #ffff00;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .qr-code-container {
          position: absolute;
          bottom: 100px;
          left: 50px;
          width: 200px;
          height: 200px;
          background-color: white;
          border: 8px solid #1e3a5f;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          z-index: 100;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .qr-code-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          display: block;
          image-rendering: crisp-edges;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .qr-label {
          position: absolute;
          bottom: 110px;
          left: 300px;
          width: 1200px;
          height: auto;
          padding: 20px 0;
          font-size: 48px;
          font-weight: 700;
          color: #000000;
          line-height: 1.4;
          text-align: left;
          font-family: Arial, sans-serif;
          text-shadow: none;
          display: flex;
          align-items: center;
          z-index: 150;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* Screen preview */
        @media screen {
          body {
            padding: 20px;
            background: #f0f0f0;
          }

          .poster-container {
            margin: 0 auto;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            zoom: 0.3;
            transform-origin: top center;
          }

          .text-field {
            border: 2px dashed rgba(255, 0, 0, 0.5) !important;
            background: rgba(255, 255, 255, 0.3) !important;
          }
        }

        /* Print styles */
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background: white;
          }

          .poster-container {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none;
            zoom: 1;
            position: absolute;
            top: 0;
            left: 0;
          }

          .poster-background {
            width: 100% !important;
            height: 100% !important;
          }

          .text-field {
            background: transparent !important;
            border: none !important;
          }

          .qr-code-container {
            border: 8px solid #1e3a5f !important;
          }

          @page {
            size: A4;
            margin: 0;
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="poster-container">
        <img src="${posterImageUrl}" alt="Poster Background" class="poster-background">
        
        <div class="text-overlay">
          <div class="text-field text-title">${saleTypeDisplay}</div>
          <div class="text-field text-date">${formattedDateTime}</div>
          <div class="text-field text-location">${listing.address || ''}${listing.suburb ? ', ' + listing.suburb : ''}</div>
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

  // Use blob URL for better reliability with popup windows
  try {
    const blob = new Blob([posterHTML], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    
    const printWindow = window.open(blobUrl, 'listing-poster-print', 'width=1200,height=1400,scrollbars=yes');
    
    if (!printWindow) {
      alert('Please disable popup blockers to print the poster');
      return;
    }
    
    console.log('✓ Print window opened with blob URL');
    
    // Trigger print after window loads
    printWindow.addEventListener('load', () => {
      console.log('✓ Print window loaded, triggering print...');
      printWindow.print();
    });
  } catch (error) {
    console.error('Error creating print window:', error);
    alert('Error opening print window. Please try again.');
  }
}

export { paperSizes };
