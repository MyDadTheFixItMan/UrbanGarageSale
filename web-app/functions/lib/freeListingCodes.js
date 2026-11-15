// Pure helpers for free listing codes: one-use codes an admin sends a person so they can publish
// one listing without paying. No Firebase, so they are unit tested directly
// (functions/test/freeListingCodes.test.js). The Cloud Functions in index.js keep the codes in
// freeListingCodes/{code}.
const crypto = require('node:crypto');
const {
    escapeHtml, EMAIL_COLOURS, siteBase, emailLayout, emailParagraph, emailList, emailBox,
} = require('./helpers');

// No 0/O, 1/I/L or 5/S, so a code read out over the phone or copied from a text message comes
// out right. Eight characters from these 29 make about 500 billion codes, and checking a code is
// rate limited, so they can't be guessed.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRTUVWXYZ2346789';
const CODE_LENGTH = 8;
const CODE_PREFIX = 'FREE';

const formatCode = (chars) => `${CODE_PREFIX}-${chars.slice(0, 4)}-${chars.slice(4)}`;

// A new random code, e.g. FREE-7KQ3-MZ2P. `randomInt(n)` returns 0..n-1.
function newFreeListingCode(randomInt = crypto.randomInt) {
    let chars = '';
    for (let i = 0; i < CODE_LENGTH; i++) chars += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    return formatCode(chars);
}

// The code as stored, from what a person typed: any case, with or without the dashes, spaces or
// the FREE at the front. Null if it can't be a code.
function normaliseFreeListingCode(input) {
    if (typeof input !== 'string' || input.length > 40) return null;
    let chars = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (chars.length === CODE_PREFIX.length + CODE_LENGTH && chars.startsWith(CODE_PREFIX)) {
        chars = chars.slice(CODE_PREFIX.length);
    }
    if (chars.length !== CODE_LENGTH || [...chars].some((c) => !CODE_ALPHABET.includes(c))) return null;
    return formatCode(chars);
}

const CODE_PROBLEMS = {
    invalid: "That code isn't valid. Check it and try again.",
    used: 'That code has already been used.',
    cancelled: 'That code has been cancelled.',
    expired: 'That code has expired.',
};

// Why a stored code can't be used today, or null if it can. `code` is the freeListingCodes
// document (null if there isn't one); `today` is the Melbourne date, YYYY-MM-DD. A code works up
// to and including its expires_on day.
function freeListingCodeProblem(code, today) {
    if (!code) return CODE_PROBLEMS.invalid;
    if (code.status === 'used') return CODE_PROBLEMS.used;
    if (code.status === 'cancelled') return CODE_PROBLEMS.cancelled;
    if (code.status !== 'unused') return CODE_PROBLEMS.invalid;
    if (typeof code.expires_on === 'string' && code.expires_on < today) return CODE_PROBLEMS.expired;
    return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
// The latest a code may expire, counted from today.
const MAX_EXPIRY_DAYS = 366;

function addDays(isoDate, days) {
    const date = new Date(`${isoDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

// The admin's new-code form, checked. Returns { name, email, note, expiresOn } with blanks as
// null, or { error } saying what to fix. The email address is optional: without one the admin
// passes the code on themselves. `today` is the Melbourne date, YYYY-MM-DD.
function freeListingCodeRequest(data, today) {
    const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
    const name = text(data?.name, 100);
    const email = text(data?.email, 254);
    const note = text(data?.note, 500);
    const expiresOn = text(data?.expiresOn, 10);
    if (email && !EMAIL.test(email)) return { error: 'Please enter a valid email address, or leave it blank' };
    if (!ISO_DATE.test(expiresOn)) return { error: 'Please choose the last day the code can be used' };
    if (expiresOn < today) return { error: "The code can't expire in the past" };
    if (expiresOn > addDays(today, MAX_EXPIRY_DAYS)) return { error: 'The code must expire within a year' };
    return { name: name || null, email: email || null, note: note || null, expiresOn };
}

const LONG_DATE = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const longDate = (isoDate) => LONG_DATE.format(new Date(`${isoDate}T00:00:00Z`));

// The code in large type, in a box that's easy to spot and copy from.
function codeBlock(code) {
    const c = EMAIL_COLOURS;
    return `
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
                    <tr><td align="center" style="background:${c.cream};border:2px dashed ${c.orangeDark};border-radius:8px;padding:14px 24px;font-family:'Courier New',Courier,monospace;font-size:26px;font-weight:bold;letter-spacing:3px;color:${c.navy};">${escapeHtml(code)}</td></tr>
                </table>`;
}

const EMAIL_CODE_NOTE = 'You received this email because the Urban Garage Sale team sent you a free listing code.';

// The email that sends a person their code. The admin types the name and note, so both are escaped.
function freeListingCodeEmailHtml({ code, name, note, expiresOn, siteUrl }) {
    return emailLayout({
        siteUrl,
        preheader: `Use code ${code} to list your next garage sale for free.`,
        heading: 'Your free garage sale listing',
        body: [
            emailParagraph(`Hi ${escapeHtml(name || 'there')},`),
            emailParagraph("Here's a code to list your next garage sale on Urban Garage Sale for free:"),
            codeBlock(code),
            note ? emailBox('A note from us', note, EMAIL_COLOURS.teal) : '',
            emailParagraph('<strong>How to use it:</strong>'),
            emailList([
                'Sign in (or create an account) and go to <strong>Create Listing</strong>.',
                'Fill in your sale details and add your photos.',
                'Under <strong>Have a free listing code?</strong> enter the code and press <strong>Apply</strong>, then <strong>Publish FREE</strong>.',
            ]),
            emailParagraph(`The code is for one listing and works until <strong>${escapeHtml(longDate(expiresOn))}</strong>. Your sale goes live once our team has checked it.`),
        ].filter(Boolean).join('\n'),
        button: { label: 'List your sale', url: `${siteBase(siteUrl)}/CreateListing` },
        note: EMAIL_CODE_NOTE,
    });
}

module.exports = {
    CODE_ALPHABET,
    newFreeListingCode,
    normaliseFreeListingCode,
    freeListingCodeProblem,
    freeListingCodeRequest,
    freeListingCodeEmailHtml,
};
