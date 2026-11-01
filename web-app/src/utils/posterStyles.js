// Styles for the printable poster built by printListingPoster. The poster is laid out at
// 2480x3508px (A4 at 300 DPI) and each .sheet scales it onto one sheet of A4 paper. Text is dark
// on white so the sign stays readable on a black-and-white printer, and everything sits at least
// 140px (about 11mm) from the edge, inside the area printers can reach.
export const POSTER_CSS = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  background: white;
  font-family: Arial, sans-serif;
}

/* One sheet of A4 paper, showing its section of the poster. */
.sheet {
  position: relative;
  width: 210mm;
  height: 297mm;
  overflow: hidden;
  background: white;
  break-after: page;
}

.sheet:last-child {
  break-after: auto;
}

.poster-container {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 2480px;
  height: 3508px;
  padding: 140px 150px;
  transform-origin: top left;
  text-align: center;
  color: #111111;
}

.poster-logo {
  height: 620px;
  object-fit: contain;
  margin: -90px 0 -30px;
}

.poster-type {
  font-weight: 900;
  line-height: 1.05;
  color: #1e3a5f;
  white-space: nowrap;
}

.poster-rule {
  width: 100%;
  margin: 50px 0 70px;
  border-top: 20px solid #f97316;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.poster-day {
  font-size: 190px;
  font-weight: 700;
  line-height: 1.2;
}

.poster-time {
  margin-top: 20px;
  font-size: 170px;
  font-weight: 700;
  line-height: 1.2;
  color: #c2410c;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.poster-address {
  margin-top: 110px;
  font-weight: 700;
  line-height: 1.15;
  color: #1e3a5f;
  overflow-wrap: anywhere;
}

.poster-suburb {
  margin-top: 20px;
  font-size: 150px;
  font-weight: 400;
  line-height: 1.2;
}

.poster-qr {
  display: flex;
  align-items: center;
  gap: 90px;
  margin-top: auto;
  text-align: left;
}

.poster-qr-image {
  display: block;
  width: 760px;
  height: 760px;
  image-rendering: pixelated;
}

.poster-qr-label {
  max-width: 1200px;
  font-size: 120px;
  font-weight: 700;
  line-height: 1.25;
  color: #1e3a5f;
}

.print-note {
  padding: 40px;
  font-size: 18px;
  text-align: center;
  color: #475569;
}

/* The print dialog opens over this window, so the poster itself only shows on paper. */
@media screen {
  .sheet {
    display: none;
  }
}

@media print {
  .print-note {
    display: none;
  }
}

@page {
  size: A4;
  margin: 0;
}
`;
