



export const isValidUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === "https:";
    } catch (err) {
        return false;
    }

}