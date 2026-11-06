

const headers = new Headers({
    // "Accept"       : "application/json",
    // "Content-Type" : "application/json",
    "User-Agent"   : "VAKEO/v1"
})

export const geocode = async (address) => {
    try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.append('q', address);
        url.searchParams.append('format', 'json');
        url.searchParams.append('limit', '5');
        // url.searchParams.append('polygon_svg', '1');

        const response = await fetch(url, {
            method: "GET",
            headers
        });
        const data = await response.json();
        return (Array.isArray(data) ? data : []).map((result) => ({
            coordinates: [parseFloat(result.lon), parseFloat(result.lat)],
            displayName: result.display_name,
            provider: 'nominatim',
        }));
    } catch (error) {
        console.error("Nominatim request error:", error.message);
        throw error;
    }


}