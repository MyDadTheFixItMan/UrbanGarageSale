import {
    escapeHtml, fillShell, isUpcomingSale, listingDetailsPage, notFoundPage, resolveRoute,
    saleEventJsonLd, salePage, sitemapXml, staticPage, suburbPage, utcOffset,
} from '../render';
import { documentTitle, listingPath, salePath, saleTitle, slugify, suburbNameFromSlug, suburbPath } from '../site';

const TODAY = '2026-11-22';
const sale = (over = {}) => ({
    id: 'abc123',
    status: 'active',
    title: 'Big Moving Sale',
    description: 'Furniture, tools & <toys>',
    suburb: 'St Kilda East',
    state: 'VIC',
    postcode: '3183',
    start_date: '2026-11-28',
    end_date: '2026-11-29',
    start_time: '08:00',
    end_time: '14:00',
    sale_type: 'moving_sale',
    photos: ['https://firebasestorage.googleapis.com/photo.jpg'],
    ...over,
});

const SHELL = '<head><!--seo:head--><title>x</title><!--/seo:head--></head><body><div id="root"><!--seo:body-->old<!--/seo:body--></div></body>';

describe('addresses', () => {
    test('slugs', () => {
        expect(slugify("O'Connor")).toBe('oconnor');
        expect(slugify('St Kilda East')).toBe('st-kilda-east');
        expect(suburbNameFromSlug('st-kilda-east')).toBe('St Kilda East');
    });

    test('sale and suburb paths never include the street address', () => {
        expect(salePath(sale({ address: '12 Smith St' }), 'abc123')).toBe('/sale/st-kilda-east-vic/abc123');
        expect(suburbPath('St Kilda East', 'VIC')).toBe('/garage-sales/vic/st-kilda-east');
    });

    test('live listings link to their sale page, others to the listing page', () => {
        expect(listingPath(sale())).toBe('/sale/st-kilda-east-vic/abc123');
        expect(listingPath(sale({ status: 'pending_approval' }))).toBe('/ListingDetails?id=abc123');
        expect(listingPath(sale({ suburb: '' }))).toBe('/ListingDetails?id=abc123');
    });

    test('a sale title names the suburb once', () => {
        expect(saleTitle(sale())).toBe('Big Moving Sale – St Kilda East VIC');
        expect(saleTitle(sale({ title: 'Moving sale in St Kilda East' }))).toBe('Moving sale in St Kilda East');
    });

    test('titles', () => {
        expect(documentTitle('About Us')).toBe('About Us | Urban Garage Sales');
        expect(documentTitle('Garage Sales Near You')).toBe('Urban Garage Sales | Garage Sales Near You');
    });
});

describe('resolveRoute', () => {
    test.each([
        ['/', '', { type: 'static', page: 'Home' }],
        ['/about', '', { type: 'static', page: 'About' }],
        ['/About', '', { type: 'redirect', location: '/about' }],
        ['/TERMS/', '?x=1', { type: 'redirect', location: '/terms?x=1' }],
        ['/Home', '?near=Coburg', { type: 'redirect', location: '/?near=Coburg' }],
        ['/Profile', '?code=1&state=2', { type: 'static', page: 'Profile' }],
        ['/profile', '', { type: 'static', page: 'Profile' }],
        ['/ListingDetails', '?id=abc123', { type: 'listingDetails', id: 'abc123' }],
        ['/ListingDetails', '?id=a/b', { type: 'listingDetails' }],
        ['/sale/coburg-vic/abc123', '', { type: 'sale', placeSlug: 'coburg-vic', id: 'abc123' }],
        ['/garage-sales/vic/coburg', '', { type: 'suburb', state: 'VIC', suburbSlug: 'coburg' }],
        ['/garage-sales/VIC/Coburg', '', { type: 'redirect', location: '/garage-sales/vic/coburg' }],
        ['/garage-sales/xx/coburg', '', { type: 'notFound' }],
        ['/this-page-does-not-exist', '', { type: 'notFound' }],
        ['/sale/coburg-vic/a.b', '', { type: 'notFound' }],
    ])('%s%s', (path, search, expected) => {
        expect(resolveRoute(path, search)).toEqual(expected);
    });
});

describe('pages', () => {
    test('static pages have their own title and canonical address', () => {
        const page = staticPage('About');
        expect(page.status).toBe(200);
        expect(page.head).toContain('<title>About Us | Urban Garage Sales</title>');
        expect(page.head).toContain('<link rel="canonical" href="https://www.urbangaragesales.com.au/about" />');
        expect(page.head).not.toContain('noindex');
        expect(staticPage('Profile').head).toContain('noindex');
    });

    test('a made-up address is a 404', () => {
        expect(notFoundPage().status).toBe(404);
        expect(notFoundPage().head).toContain('noindex');
    });

    test('a sale page has its details, Event data and no street address', () => {
        const page = salePage({ id: 'abc123', listing: sale({ address: '12 Smith St' }), placeSlug: 'st-kilda-east-vic', today: TODAY });
        expect(page.status).toBe(200);
        expect(page.head).toContain('<title>Big Moving Sale – St Kilda East VIC | Urban Garage Sales</title>');
        expect(page.head).toContain('href="https://www.urbangaragesales.com.au/sale/st-kilda-east-vic/abc123"');
        expect(page.head).toContain('"@type":"Event"');
        expect(page.head).toContain('"startDate":"2026-11-28T08:00:00+11:00"');
        expect(page.body).toContain('Furniture, tools &amp; &lt;toys&gt;');
        expect(page.body).toContain('href="/garage-sales/vic/st-kilda-east"');
        expect(page.head + page.body).not.toContain('Smith St');
    });

    test('Event data escapes "<" so a title cannot close the script tag', () => {
        const page = salePage({ id: 'abc123', listing: sale({ title: '</script><b>' }), placeSlug: 'st-kilda-east-vic', today: TODAY });
        expect(page.head).not.toContain('</script><b>');
    });

    test('a sale page at an old suburb address moves to the current one', () => {
        expect(salePage({ id: 'abc123', listing: sale(), placeSlug: 'coburg-vic', today: TODAY })).toEqual({ status: 301, location: '/sale/st-kilda-east-vic/abc123' });
    });

    test('a finished or missing sale is a 404 that points to its suburb', () => {
        const finished = salePage({ id: 'abc123', listing: sale({ end_date: '2026-11-21', start_date: '2026-11-21' }), placeSlug: 'st-kilda-east-vic', today: TODAY });
        expect(finished.status).toBe(404);
        expect(finished.body).toContain('href="/garage-sales/vic/st-kilda-east"');
        expect(salePage({ id: 'x', listing: null, placeSlug: 'nowhere', today: TODAY }).status).toBe(404);
    });

    test('the old listing page points to the sale page, or stays out of results', () => {
        expect(listingDetailsPage({ id: 'abc123', listing: sale(), today: TODAY }).head).toContain('/sale/st-kilda-east-vic/abc123');
        const missing = listingDetailsPage({ id: 'abc123', listing: null, today: TODAY });
        expect(missing.status).toBe(200);
        expect(missing.head).toContain('noindex');
    });

    test('a suburb page lists its upcoming sales and links nearby suburbs', () => {
        const listings = [
            sale(),
            sale({ id: 'def456', title: 'Toys', start_date: '2026-11-25', end_date: '2026-11-25' }),
            sale({ id: 'old', title: 'Old', start_date: '2026-11-01', end_date: '2026-11-01' }),
            sale({ id: 'b', suburb: 'Balaclava' }),
        ];
        const page = suburbPage({ state: 'VIC', suburbSlug: 'st-kilda-east', listings, today: TODAY });
        expect(page.head).toContain('<title>Garage Sales in St Kilda East, VIC | Urban Garage Sales</title>');
        expect(page.head).not.toContain('noindex');
        expect(page.body.indexOf('Toys')).toBeLessThan(page.body.indexOf('Big Moving Sale'));
        expect(page.body).not.toContain('>Old<');
        expect(page.body).toContain('href="/garage-sales/vic/balaclava"');
    });

    test('a suburb with no sales stays out of results', () => {
        const page = suburbPage({ state: 'VIC', suburbSlug: 'coburg', listings: [], today: TODAY });
        expect(page.status).toBe(200);
        expect(page.head).toContain('noindex');
        expect(page.body).toContain('Garage Sales in Coburg, VIC');
    });

    test('fillShell swaps the head tags and content', () => {
        const html = fillShell(SHELL, { head: '<title>New $& title</title>', body: '<p>new</p>' });
        expect(html).toContain('<title>New $& title</title>');
        expect(html).toContain('<!--seo:body--><p>new</p><!--/seo:body-->');
        expect(html).not.toContain('old');
        expect(() => fillShell('<html></html>', { head: '', body: '' })).toThrow();
    });
});

describe('Event data', () => {
    test('uses the state time zone, daylight saving included', () => {
        expect(utcOffset('2026-11-28', '08:00', 'Australia/Melbourne')).toBe('+11:00');
        expect(utcOffset('2026-06-28', '08:00', 'Australia/Melbourne')).toBe('+10:00');
        expect(utcOffset('2026-11-28', '08:00', 'Australia/Brisbane')).toBe('+10:00');
        expect(utcOffset('2026-11-28', '08:00', 'Australia/Adelaide')).toBe('+10:30');
        expect(utcOffset('2026-11-28', '08:00', 'Australia/Perth')).toBe('+08:00');
    });

    test('locates the sale by suburb only', () => {
        const data = saleEventJsonLd(sale({ address: '12 Smith St' }), 'abc123');
        expect(data.location.address).toEqual({ '@type': 'PostalAddress', addressLocality: 'St Kilda East', addressRegion: 'VIC', postalCode: '3183', addressCountry: 'AU' });
        expect(data.endDate).toBe('2026-11-29T14:00:00+11:00');
        expect(JSON.stringify(data)).not.toContain('Smith');
    });
});

describe('sitemap', () => {
    test('lists the public pages, upcoming sales and their suburbs', () => {
        const xml = sitemapXml([sale(), sale({ id: 'old', start_date: '2026-11-01', end_date: '2026-11-01' }), sale({ id: 'p', status: 'pending_approval' })], TODAY);
        expect(xml).toContain('<loc>https://www.urbangaragesales.com.au/</loc>');
        expect(xml).toContain('<loc>https://www.urbangaragesales.com.au/about</loc>');
        expect(xml).toContain('<loc>https://www.urbangaragesales.com.au/sale/st-kilda-east-vic/abc123</loc>');
        expect(xml).toContain('<loc>https://www.urbangaragesales.com.au/garage-sales/vic/st-kilda-east</loc>');
        expect(xml).not.toContain('/old<');
        expect(xml).not.toContain('/p<');
        expect(xml).not.toContain('Profile');
    });

    test('a sale on today is still upcoming', () => {
        expect(isUpcomingSale(sale({ start_date: TODAY, end_date: TODAY }), TODAY)).toBe(true);
    });
});

test('escapeHtml', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});
