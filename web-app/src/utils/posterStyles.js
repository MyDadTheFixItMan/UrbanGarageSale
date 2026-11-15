// Styles for the printable poster built by printListingPoster. The poster is laid out at
// 2480x3508px (A4 at 300 DPI) and each .sheet scales it onto one sheet of A4 paper. Text is always
// dark on white or orange so the sign stays readable on a black-and-white printer, and everything
// sits at least 140px (about 11mm) from the edge, inside the area printers can reach. The fonts are
// declared in printGarageSaleSign.js, which knows the site's address.
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
  border-left: 1mm solid #0f172a;
}

.join-mark-left {
  left: 8.5mm;
}

/* Both words read upward on the strip that ends up hidden: "Fold" is folded under, and the fold
   then covers "Join". So the line runs along the base of "Fold" and the top of "Join". */
.join-mark-left::before {
  content: 'Fold';
  right: calc(100% + 1.3mm);
}

.join-mark-right::before {
  content: 'Join';
  left: 0.8mm;
}

.join-mark::before {
  position: absolute;
  top: 50%;
  writing-mode: vertical-rl;
  transform: translateY(-50%) rotate(180deg);
  font-size: 7pt;
  line-height: 1;
  white-space: nowrap;
  color: #1e3a5f;
}

.join-mark-right {
  right: 8.5mm;
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
  align-items: flex-start;
  width: 2480px;
  height: 3508px;
  padding: 150px;
  transform-origin: top left;
  font-family: Archivo, Arial, sans-serif;
  color: #0b1f33;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* On one sheet the two sections are just part of the page. */
.poster-section {
  display: contents;
}

/* Across several sheets, each section fills half the poster, so no row sits on the join between
   the top and bottom sheets. The top half shrinks a little to fit above the join. */
.poster-tiled {
  padding: 0 150px;
}

.poster-tiled .poster-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
}

.poster-tiled .poster-top {
  --fit: 0.92;
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

/* The QR code on the left sheet and its prompt on the right, clear of the join between them. */
.poster-tiled .poster-foot {
  grid-template-columns: 1fr 1fr;
  gap: 240px;
}

.poster-tiled .poster-qr {
  justify-self: center;
}

.poster-tiled .poster-cta-head {
  font-size: 130px;
}

.poster-tiled .poster-brand {
  flex-wrap: wrap;
}

/* Black on orange, never white on orange: the contrast holds when the orange prints as grey. */
.poster-band {
  width: 100%;
  padding: 70px 110px 80px;
  border-radius: 70px;
  background: #ff9500;
}

.poster-type {
  font-family: Anton, Impact, 'Arial Narrow', sans-serif;
  line-height: 0.92;
  white-space: nowrap;
}

.poster-days {
  margin-top: 70px;
  font-family: Anton, Impact, 'Arial Narrow', sans-serif;
  line-height: 1;
  white-space: nowrap;
}

.poster-time {
  margin-top: 36px;
  padding: 38px 70px 44px;
  border-radius: 999px;
  background: #0b1f33;
  font-family: Anton, Impact, 'Arial Narrow', sans-serif;
  font-size: 170px;
  line-height: 1;
  text-transform: uppercase;
  color: #ffffff;
}

.poster-address {
  margin-top: 56px;
  font-weight: 800;
  line-height: 1.08;
  overflow-wrap: anywhere;
}

.poster-suburb {
  margin-top: 14px;
  font-size: 120px;
  font-weight: 600;
  line-height: 1.2;
  color: #44505e;
}

/* The listing's title: what's for sale, to give passers-by a reason to stop. */
.poster-hook {
  margin-top: 50px;
  padding-left: 60px;
  border-left: 22px solid #ff9500;
  font-size: 96px;
  font-weight: 600;
  line-height: 1.22;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.poster-foot {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 90px;
  align-items: center;
  width: 100%;
  margin-top: auto;
  padding-top: 60px;
  border-top: 10px solid #0b1f33;
}

.poster-qr {
  width: 540px;
  height: 540px;
  padding: 26px;
  border: 14px solid #0b1f33;
  border-radius: 46px;
}

.poster-qr-image {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.poster-cta {
  display: grid;
  gap: 16px;
}

.poster-cta-head {
  font-family: Anton, Impact, 'Arial Narrow', sans-serif;
  font-size: 150px;
  line-height: 0.98;
  text-transform: uppercase;
}

.poster-cta-sub {
  font-size: 82px;
  font-weight: 600;
  color: #44505e;
}

/* Every sign also points people to the site. */
.poster-brand {
  display: flex;
  align-items: center;
  gap: 36px;
  margin-top: 20px;
  font-size: 64px;
  font-weight: 600;
  line-height: 1.2;
  color: #44505e;
}

.poster-brand b {
  display: block;
  font-size: 72px;
  font-weight: 800;
  color: #0b1f33;
}

.poster-logo {
  height: 180px;
  width: auto;
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
