const ENDPOINT = "https://api.mapbox.com/search/geocode/v6/forward";
const TIMEOUT_MS = 5000;


export const geocode = async (address) => {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token)
        throw new Error("MAPBOX_ACCESS_TOKEN is not configured");

    const url = new URL(ENDPOINT);
    url.searchParams.append("q", address);
    url.searchParams.append("limit", "1");
    url.searchParams.append("access_token", token);

    let response;
    try {
        response = await fetch(url, {
            method: "GET",
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch (error) {
        throw new Error(`Mapbox request failed: ${error.message}`);
    }

    if (!response.ok)
        throw new Error(`Mapbox request failed with status ${response.status}`);

    const data = await response.json();
    const feature = data.features?.[0];
    if (!feature) {
        return {
            coordinates: [],
            displayName: "No results",
            provider: "mapbox",
        };
    }

    return {
        coordinates: feature.geometry?.coordinates ?? [],
        displayName: feature.properties?.full_address ?? address,
        provider: "mapbox",
    };
};
