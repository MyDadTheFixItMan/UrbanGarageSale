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

/* One sheet of A4 paper, showing its section of the poster. Containment makes the sheet a single
   unit: the browser lays the poster out before scaling it, and without this it splits the poster
   across pages at its full size, so sections of a multi-sheet poster land on the wrong sheets. */
.sheet {
  position: relative;
  width: 210mm;
  height: 297mm;
  overflow: hidden;
  contain: strict;
  background: white;
  break-after: page;
}

.sheet:last-child {
  break-after: auto;
}

/* The join between side-by-side sheets: JOIN_INSET_MM in printGarageSaleSign.js from the edge. */
.join-mark {
  position: absolute;
  height: 8mm;
  border-left: 1mm solid #94a3b8;
}

.join-mark-left {
  left: 6.5mm;
}

/* Only the sheet on the right of a join gets folded, so only its marks say so. */
.join-mark-left::before {
  content: 'fold';
  position: absolute;
  top: 50%;
  left: -0.15mm;
  transform: translate(-50%, -50%) rotate(-90deg);
  font-size: 7pt;
  line-height: 1;
  color: #0f172a;
}

.join-mark-right {
  right: 6.5mm;
}

.join-mark-top {
  top: 11mm;
}

.join-mark-bottom {
  bottom: 8mm;
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

/* On one sheet the two sections are just part of the page. */
.poster-section {
  display: contents;
}

/* Across several sheets, each section fills half the poster, so no row sits on the join between
   the top and bottom sheets. */
.poster-tiled {
  padding: 0 150px;
}

.poster-tiled .poster-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.poster-tiled .poster-top {
  height: calc(1754px / var(--fit));
  padding-top: 140px;
  zoom: var(--fit);
}

.poster-tiled .poster-bottom {
  height: 1754px;
  padding: 120px 0 140px;
}

.poster-tiled .poster-address {
  margin-top: 0;
}

/* The QR code on the left sheet and its label on the right, clear of the join between them. */
.poster-tiled .poster-qr {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 240px;
  justify-items: center;
  width: 100%;
}

.poster-tiled .poster-qr-label {
  justify-self: start;
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
