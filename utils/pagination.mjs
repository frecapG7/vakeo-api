export const sanitizeLimit = (limit, defaultValue = 10, max = 100) => {
    let parsed = parseInt(limit, 10);
    if (isNaN(parsed) || parsed <= 0) {
        return defaultValue;
    }
    return Math.min(parsed, max);
};

export const sanitizeSearchText = (text, maxLength = 100) => {
    if (typeof text !== 'string') {
        return null;
    }
    if (text.length === 0) {
        return '';
    }
    if (text.length > maxLength) {
        text = text.substring(0, maxLength);
    }
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
