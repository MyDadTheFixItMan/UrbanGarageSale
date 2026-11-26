// A flyer image of a sale for Instagram posts and Stories, where links can't be clicked. It looks
// like the printed sign (utils/printGarageSaleSign.js) and is drawn on a canvas in the browser.
// Like the public listing page, it shows the suburb, never the street address. Its QR code opens
// the listing, like the sign's.
import QRCode from 'qrcode';
import { formatPosterDates, saleTypeLabel, saleTypeLines } from '@/utils/printGarageSaleSign';
import { flyerFileName, listingShareUrl, salePlace, SHARE_CHANNELS } from '@/lib/share';

// 4:5, the tallest shape Instagram shows in the feed without cropping.
export const FLYER_WIDTH = 1080;
export const FLYER_HEIGHT = 1350;
const MARGIN = 80;
const CONTENT_WIDTH = FLYER_WIDTH - MARGIN * 2;

// The printed sign's colours on the website's cream.
const INK = '#0b1f33';
const ORANGE = '#ff9500';
const CREAM = '#f5f1e8';
const MUTED = '#44505e';

const display = (size) => `${size}px Anton, Impact, "Arial Narrow", sans-serif`;
const text = (weight, size) => `${weight} ${size}px Archivo, Arial, sans-serif`;

const FONT_WAIT_MS = 3000;
const SMALLEST_SCALE = 0.6;

// The sign's fonts, from public/fonts. Loaded once; if they're slow or fail, the flyer is drawn in
// the fallback fonts rather than not at all.
let fontsLoading;
function fontsReady() {
    if (!fontsLoading) {
        const faces = [
            new FontFace('Anton', 'url(/fonts/anton-latin.woff2)'),
            new FontFace('Archivo', 'url(/fonts/archivo-latin.woff2)', { weight: '100 900' }),
        ];
        // TypeScript's DOM types leave out FontFaceSet.add, which every browser has.
        const fontSet = /** @type {FontFaceSet & { add(face: FontFace): FontFaceSet }} */ (document.fonts);
        fontsLoading = Promise.all(faces.map(async (face) => fontSet.add(await face.load()))).catch(() => {});
    }
    return Promise.race([fontsLoading, new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS))]);
}

function loadImage(src) {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = src;
    });
}

/**
 * The largest font size, up to `max`, at which text fits `width`; `widthAt(size)` measures it.
 * @param {(size: number) => number} widthAt
 */
export function fitFontSize(widthAt, max, width, min = 12) {
    const measured = widthAt(max);
    if (measured <= width) return max;
    return Math.max(min, Math.floor((max * width) / measured));
}

/**
 * Splits text into at most `maxLines` lines no wider than `width`. If it doesn't all fit, the last
 * line ends in "…". `widthOf(text)` measures a line.
 * @param {(text: string) => number} widthOf
 * @returns {string[]}
 */
export function wrapLines(widthOf, value, width, maxLines) {
    const words = String(value ?? '').split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && widthOf(candidate) > width) {
            lines.push(current);
            current = word;
        } else {
            current = candidate;
        }
    }
    if (current) lines.push(current);

    const kept = lines.slice(0, maxLines);
    return kept.map((line, index) => {
        const cutShort = index === kept.length - 1 && lines.length > maxLines;
        if (!cutShort && widthOf(line) <= width) return line;
        let shortened = line;
        while (shortened.length > 1 && widthOf(`${shortened}…`) > width) shortened = shortened.slice(0, -1).trimEnd();
        return `${shortened}…`;
    });
}

function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

// How far capitals rise above the baseline in the current font.
const capHeight = (ctx) => ctx.measureText('H').actualBoundingBoxAscent || 0;

// What the flyer says, from the listing.
function flyerContent(listing) {
    const { days, time } = formatPosterDates(listing);
    return {
        typeLines: saleTypeLines(saleTypeLabel(listing.sale_type)),
        days,
        time: time.toUpperCase(),
        place: salePlace(listing),
        title: listing.title || '',
    };
}

// Lays out (and with `draw`, draws) everything above the footer at the given scale, and returns
// where it ends. Called first without drawing to find a scale at which it all fits.
function drawBody(ctx, content, scale, draw) {
    const s = (value) => Math.round(value * scale);
    let y = MARGIN;

    // The sale type, black on orange like the sign, each line as large as fits.
    const padX = s(64);
    const padY = s(58);
    const lineGap = s(28);
    const typeLines = content.typeLines.map((line) => {
        const size = fitFontSize((value) => {
            ctx.font = display(value);
            return ctx.measureText(line).width;
        }, s(200), CONTENT_WIDTH - padX * 2);
        ctx.font = display(size);
        return { line, size, cap: capHeight(ctx) };
    });
    const bandHeight = padY * 2 + typeLines.reduce((total, { cap }) => total + cap, 0) + lineGap * (typeLines.length - 1);
    if (draw) {
        ctx.fillStyle = ORANGE;
        roundedRect(ctx, MARGIN, y, CONTENT_WIDTH, bandHeight, s(56));
        ctx.fill();
        ctx.fillStyle = INK;
        let baseline = y + padY;
        for (const { line, size, cap } of typeLines) {
            baseline += cap;
            ctx.font = display(size);
            ctx.fillText(line, MARGIN + padX, baseline);
            baseline += lineGap;
        }
    }
    y += bandHeight;

    // The days, as large as fits on one line.
    const daysSize = fitFontSize((value) => {
        ctx.font = display(value);
        return ctx.measureText(content.days).width;
    }, s(150), CONTENT_WIDTH);
    ctx.font = display(daysSize);
    const daysCap = capHeight(ctx);
    y += s(64) + daysCap;
    if (draw) {
        ctx.fillStyle = INK;
        ctx.fillText(content.days, MARGIN, y);
    }

    // The hours, white on a dark pill.
    if (content.time) {
        ctx.font = display(s(78));
        const timeCap = capHeight(ctx);
        const pillPadX = s(52);
        const pillPadY = s(26);
        const pillWidth = Math.min(CONTENT_WIDTH, ctx.measureText(content.time).width + pillPadX * 2);
        const pillHeight = timeCap + pillPadY * 2;
        y += s(40);
        if (draw) {
            ctx.fillStyle = INK;
            roundedRect(ctx, MARGIN, y, pillWidth, pillHeight, pillHeight / 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(content.time, MARGIN + pillPadX, y + pillPadY + timeCap);
        }
        y += pillHeight;
    }

    // The suburb.
    if (content.place) {
        const placeSize = fitFontSize((value) => {
            ctx.font = text(800, value);
            return ctx.measureText(content.place).width;
        }, s(96), CONTENT_WIDTH);
        ctx.font = text(800, placeSize);
        y += s(64) + capHeight(ctx);
        if (draw) {
            ctx.fillStyle = INK;
            ctx.fillText(content.place, MARGIN, y);
        }
    }

    // What's for sale, beside an orange bar like the sign's.
    if (content.title) {
        const size = s(50);
        const barWidth = s(16);
        const indent = barWidth + s(36);
        const lineHeight = Math.round(size * 1.25);
        ctx.font = text(600, size);
        const lines = wrapLines((line) => ctx.measureText(line).width, content.title, CONTENT_WIDTH - indent, 2);
        const top = y + s(52);
        const height = lineHeight * lines.length;
        if (draw) {
            ctx.fillStyle = ORANGE;
            ctx.fillRect(MARGIN, top, barWidth, height);
            ctx.fillStyle = INK;
            lines.forEach((line, index) => ctx.fillText(line, MARGIN + indent, top + index * lineHeight + Math.round(size * 0.95)));
        }
        y = top + height;
    }
    return y;
}

const FOOTER_HEIGHT = 280;
const QR_SIZE = 248;
// White space around the code, in modules: scanners need some to find it.
const QR_QUIET_MODULES = 2;

/**
 * The address the flyer's QR code opens: the listing's page, tagged so visits from it show up.
 * @param {string} origin
 * @param {string} listingId
 */
export function flyerQrUrl(origin, listingId) {
    return listingShareUrl(origin, listingId, SHARE_CHANNELS.FLYER);
}

// Draws a QR code of `value`, dark squares on a white tile, filling a `size` square at (x, y).
function drawQrCode(ctx, value, x, y, size) {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const cells = modules.size + QR_QUIET_MODULES * 2;
    const cell = size / cells;
    ctx.fillStyle = '#ffffff';
    roundedRect(ctx, x, y, size, size, 16);
    ctx.fill();
    ctx.fillStyle = '#000000';
    for (let row = 0; row < modules.size; row += 1) {
        for (let col = 0; col < modules.size; col += 1) {
            if (!modules.get(row, col)) continue;
            // Whole pixels, a hair oversized, so no faint seams show between squares.
            const left = Math.floor(x + (col + QR_QUIET_MODULES) * cell);
            const top = Math.floor(y + (row + QR_QUIET_MODULES) * cell);
            ctx.fillRect(left, top, Math.ceil(cell) + 1, Math.ceil(cell) + 1);
        }
    }
}

// Along the bottom: the site's logo and address, and a QR code that opens the listing, so people
// can find the sale from a post whose links can't be clicked.
function drawFooter(ctx, logo, qrValue) {
    const top = FLYER_HEIGHT - MARGIN - FOOTER_HEIGHT;
    ctx.fillStyle = INK;
    ctx.fillRect(MARGIN, top, CONTENT_WIDTH, 8);

    const qrTop = top + 8 + (FOOTER_HEIGHT - 8 - QR_SIZE) / 2;
    let textWidth = CONTENT_WIDTH;
    if (qrValue) {
        try {
            drawQrCode(ctx, qrValue, FLYER_WIDTH - MARGIN - QR_SIZE, qrTop, QR_SIZE);
            textWidth -= QR_SIZE + 40;
        } catch {
            // No code rather than no flyer; the web address below still says where to look.
        }
    }

    if (logo) {
        const height = 100;
        const width = (logo.width / logo.height) * height;
        ctx.drawImage(logo, MARGIN, top + 40, width, height);
    }
    const invite = qrValue && textWidth < CONTENT_WIDTH ? 'Scan for photos and details' : 'See photos and details at';
    ctx.fillStyle = MUTED;
    ctx.font = text(600, fitFontSize((size) => {
        ctx.font = text(600, size);
        return ctx.measureText(invite).width;
    }, 40, textWidth));
    ctx.fillText(invite, MARGIN, top + 200);
    ctx.fillStyle = INK;
    ctx.font = text(800, fitFontSize((size) => {
        ctx.font = text(800, size);
        return ctx.measureText('urbangaragesales.com.au').width;
    }, 48, textWidth));
    ctx.fillText('urbangaragesales.com.au', MARGIN, top + 256);
}

/**
 * Draws the listing's flyer and returns it as a PNG file, or null if the browser can't draw it.
 * @returns {Promise<File | null>}
 */
export async function createShareFlyer(listing) {
    const canvas = document.createElement('canvas');
    canvas.width = FLYER_WIDTH;
    canvas.height = FLYER_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const [logo] = await Promise.all([loadImage('/logo-header.webp'), fontsReady()]);
    const content = flyerContent(listing);

    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, FLYER_WIDTH, FLYER_HEIGHT);
    ctx.textBaseline = 'alphabetic';

    // Shrink everything a little at a time until it fits above the footer.
    const room = FLYER_HEIGHT - MARGIN - FOOTER_HEIGHT - 48;
    let scale = 1;
    while (scale > SMALLEST_SCALE && drawBody(ctx, content, scale, false) > room) scale -= 0.04;
    drawBody(ctx, content, scale, true);
    drawFooter(ctx, logo, listing.id ? flyerQrUrl(window.location.origin, listing.id) : '');

    // JPEG: Instagram's share option handles it more reliably than PNG.
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    return blob ? new File([blob], flyerFileName(listing), { type: 'image/jpeg' }) : null;
}
