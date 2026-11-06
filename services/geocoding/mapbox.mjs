const ENDPOINT = "https://api.mapbox.com/search/geocode/v6/forward";
const TIMEOUT_MS = 5000;
const MAX_RESULTS = 5;


export const geocode = async (address) => {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token)
        throw new Error("MAPBOX_ACCESS_TOKEN is not configured");

    const url = new URL(ENDPOINT);
    url.searchParams.append("q", address);
    url.searchParams.append("limit", String(MAX_RESULTS));
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
    // Every match must be placeable: features without a usable [lon, lat]
    // pair are dropped rather than returned with empty coordinates.
    return (data.features ?? [])
        .filter((feature) => (feature.geometry?.coordinates?.length ?? 0) > 1)
        .map((feature) => ({
            coordinates: feature.geometry.coordinates,
            displayName: feature.properties?.full_address ?? address,
            provider: "mapbox",
        }));
};
