

const forbiddenHosts = /^(192\.168\..*|localhost)$/i;



export const isValidUrl = (value) => {
    try {
        const url = new URL(value);
        if (forbiddenHosts.test(url.host))
            return false;
        return url.protocol === "https:";
    } catch (err) {
        return false;
    }
}


// Seal an untrusted upstream JSON list: non-array container → [], null or
// undefined entries dropped. A degenerate 200 payload yields an empty list
// instead of a 500 (geocoding providers, review PR #80).
export const compactArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);