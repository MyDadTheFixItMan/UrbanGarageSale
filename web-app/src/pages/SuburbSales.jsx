import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Home from './Home';
import PageNotFound from '@/lib/PageNotFound';
import { documentTitle, stateFromSlug, suburbNameFromSlug, suburbTitle } from '@/lib/seo/site';

// A suburb's page (/garage-sales/vic/coburg): the home page, searching that suburb. Search
// engines get a list of its sales from the server first (src/lib/seo/render.js, suburbPage).
export default function SuburbSales() {
    const { state: stateSlug, suburb: suburbSlug } = useParams();
    const state = stateFromSlug(stateSlug);
    const suburb = suburbNameFromSlug(suburbSlug);
    const title = suburbTitle(suburb, state);

    useEffect(() => {
        if (state && suburb) document.title = documentTitle(title);
    }, [state, suburb, title]);

    if (!state || !suburb) return <PageNotFound />;
    return <Home near={`${suburb} ${state}`} heading={title} />;
}
