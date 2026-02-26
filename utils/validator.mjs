

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