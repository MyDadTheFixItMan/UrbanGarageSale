// Styles for the printable A4 poster (2480x3508px @ 300 DPI) built by printListingPoster.
export const POSTER_CSS = `
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
`;
