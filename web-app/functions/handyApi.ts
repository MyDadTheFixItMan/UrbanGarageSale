import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const HANDYAPI_BASE_URL = 'https://handyapi.com/api';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, searchText, suburb, postcode, address } = await req.json();
        const apiKey = Deno.env.get('HandyAPI');

        if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
        }

        // Autocomplete endpoint
        if (action === 'autocomplete' && searchText) {
            const response = await fetch(
                `${HANDYAPI_BASE_URL}/Suburb/Search?Query=${encodeURIComponent(searchText)}`,
                {
                    headers: {
                        'x-api-key': apiKey,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`HandyAPI error: ${response.status}`);
            }

            const data = await response.json();
            return Response.json(data);
        }

        // Validate suburb and postcode
        if (action === 'validate' && suburb && postcode) {
            const response = await fetch(
                `${HANDYAPI_BASE_URL}/Suburb/Validate`,
                {
                    method: 'POST',
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ suburb, postcode }),
                }
            );

            if (!response.ok) {
                throw new Error(`HandyAPI error: ${response.status}`);
            }

            const data = await response.json();
            return Response.json(data);
        }

        // Geocode endpoint
        if (action === 'geocode' && address) {
            const response = await fetch(
                `${HANDYAPI_BASE_URL}/Geocoding/Address?Address=${encodeURIComponent(address)}`,
                {
                    headers: {
                        'x-api-key': apiKey,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`HandyAPI error: ${response.status}`);
            }

            const data = await response.json();
            return Response.json(data);
        }

        return Response.json({ error: 'Invalid action or missing parameters' }, { status: 400 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});