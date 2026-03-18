

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
        url.searchParams.append('limit', '1');
        // url.searchParams.append('polygon_svg', '1');

        const response = await fetch(url, {
            method: "GET",
            headers
        });
        const data = await response.json();
        if (data.length > 0) {
            const { lat, lon, display_name } = data[0];
            return {
                coordinates: [parseFloat(lon), parseFloat(lat)],
                displayName: display_name,
                provider: 'nominatim',
            };
        } else {
            return {
                coordinates: [],
                displayName: "No results",
                provider: "nominatim"
            }
        }
    } catch (error) {
        console.error("Nominatim request error:", error.message);
        throw error;
    }


}