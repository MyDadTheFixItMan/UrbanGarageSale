const test = require('node:test');
const assert = require('node:assert/strict');
const {
    RULE_IDS, SYSTEM_PROMPT, VERDICT_SCHEMA, basicProblems, reviewFingerprint, listingText, readVerdict, adminReviewEmailHtml,
} = require('../lib/listingReview');

const listing = {
    title: 'Big family garage sale',
    description: 'Furniture, toys, books and kitchenware.',
    address: '1 Example St',
    suburb: 'Ocean Grove',
    postcode: '3226',
    state: 'VIC',
    start_date: '2026-12-05',
    end_date: '2026-12-06',
    start_time: '08:00',
    end_time: '14:00',
    sale_type: 'garage_sale',
    photos: [
        'https://firebasestorage.googleapis.com/v0/b/x/o/listings%2Fu1%2Fa.jpg?alt=media',
        'https://firebasestorage.googleapis.com/v0/b/x/o/listings%2Fu1%2Fb.jpg?alt=media',
    ],
    user_id: 'u1',
};

const reply = (text, stop_reason = 'end_turn') => ({ stop_reason, content: [{ type: 'text', text }] });

test('basicProblems passes a complete listing', () => {
    assert.deepEqual(basicProblems(listing), []);
});

test('basicProblems needs at least two photos', () => {
    assert.match(basicProblems({ ...listing, photos: listing.photos.slice(0, 1) })[0].reason, /1 photo;/);
});

test('basicProblems flags missing photos and blank fields', () => {
    const problems = basicProblems({ ...listing, photos: [], description: '  ', suburb: undefined });
    assert.deepEqual(problems.map((p) => p.rule), ['no_photos', 'missing_fields']);
    assert.match(problems[1].reason, /Description, Suburb/);
});

test('reviewFingerprint changes with reviewed content only', () => {
    const base = reviewFingerprint(listing);
    assert.equal(reviewFingerprint({ ...listing, status: 'active', thumbnails: ['t'] }), base);
    assert.notEqual(reviewFingerprint({ ...listing, description: 'Something else' }), base);
    assert.notEqual(reviewFingerprint({ ...listing, photos: [] }), base);
});

test('every rule is offered to Claude and in its answer schema', () => {
    for (const id of RULE_IDS) assert.match(SYSTEM_PROMPT, new RegExp(`\\[${id}\\]`));
    assert.deepEqual(VERDICT_SCHEMA.properties.problems.items.properties.rule.enum, [...RULE_IDS, 'other']);
});

test('listingText shows the sale type label and photo count', () => {
    const text = listingText(listing, 3);
    assert.match(text, /<sale_type>Garage Sale<\/sale_type>/);
    assert.match(text, /3 photos follow/);
});

test('readVerdict approves only a clean approval', () => {
    assert.deepEqual(readVerdict(reply('{"decision":"approve","problems":[]}')), { decision: 'approve', problems: [] });
    const mixed = readVerdict(reply('{"decision":"approve","problems":[{"rule":"scam","reason":"Asks for a deposit."}]}'));
    assert.equal(mixed.decision, 'review');
    assert.equal(mixed.problems[0].rule, 'scam');
});

test('readVerdict sends anything unusual for review', () => {
    assert.equal(readVerdict(reply('not json')).decision, 'review');
    assert.equal(readVerdict(reply('{"decision":"approve","problems":[]}', 'max_tokens')).decision, 'review');
    assert.equal(readVerdict({ stop_reason: 'refusal', content: [] }).decision, 'review');
    assert.equal(readVerdict(undefined).decision, 'review');
    const unknownRule = readVerdict(reply('{"decision":"review","problems":[{"rule":"made_up","reason":"x"}]}'));
    assert.equal(unknownRule.problems[0].rule, 'other');
    const noReason = readVerdict(reply('{"decision":"review","problems":[]}'));
    assert.equal(noReason.problems.length, 1);
});

test('adminReviewEmailHtml escapes seller text and lists problems', () => {
    const html = adminReviewEmailHtml({
        kind: 'listing',
        listing: { ...listing, title: '<script>x</script>' },
        verdict: { decision: 'review', problems: [{ rule: 'weapons', reason: 'Photo 2 shows a rifle.' }] },
        adminUrl: 'https://urbangaragesales.com.au/AdminDashboard',
        footer: 'footer',
    });
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /Photo 2 shows a rifle\./);
    assert.match(html, /Claude did not approve it/);
});
