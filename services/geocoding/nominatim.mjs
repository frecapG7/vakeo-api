import { GEOCODE_MAX_RESULTS } from "../../utils/constants.mjs";
import { compactArray } from "../../utils/validator.mjs";

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
        url.searchParams.append('limit', String(GEOCODE_MAX_RESULTS));
        // url.searchParams.append('polygon_svg', '1');

        const response = await fetch(url, {
            method: "GET",
            headers
        });
        const data = await response.json();
        // Same invariant as the mapbox provider: every returned match carries
        // a placeable [lon, lat] pair, and compactArray seals the envelope —
        // a non-array payload or null entries degrade to an empty list
        // instead of a 500. The max-5 cap is the service layer's, sliced
        // once for every provider (review PR #80).
        return compactArray(data)
            .map((result) => ({
                coordinates: [parseFloat(result.lon), parseFloat(result.lat)],
                displayName: result.display_name,
                provider: 'nominatim',
            }))
            .filter((result) =>
                Number.isFinite(result.coordinates[0]) && Number.isFinite(result.coordinates[1]));
    } catch (error) {
        console.error("Nominatim request error:", error.message);
        throw error;
    }


}