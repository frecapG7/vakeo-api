

const headers = new Headers({
    // "Accept"       : "application/json",
    // "Content-Type" : "application/json",
    "User-Agent"   : "VAKEO/v1"
})

const MAX_RESULTS = 5;

export const geocode = async (address) => {
    try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.append('q', address);
        url.searchParams.append('format', 'json');
        url.searchParams.append('limit', String(MAX_RESULTS));
        // url.searchParams.append('polygon_svg', '1');

        const response = await fetch(url, {
            method: "GET",
            headers
        });
        const data = await response.json();
        // Same invariant as the mapbox provider: every returned match carries
        // a placeable [lon, lat] pair, and the list is capped here rather than
        // trusting the provider's limit parameter alone.
        return (Array.isArray(data) ? data : [])
            .map((result) => ({
                coordinates: [parseFloat(result.lon), parseFloat(result.lat)],
                displayName: result.display_name,
                provider: 'nominatim',
            }))
            .filter((result) =>
                Number.isFinite(result.coordinates[0]) && Number.isFinite(result.coordinates[1]))
            .slice(0, MAX_RESULTS);
    } catch (error) {
        console.error("Nominatim request error:", error.message);
        throw error;
    }


}