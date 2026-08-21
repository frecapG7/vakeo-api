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

export const buildCursor = (cursorData) => {
    
    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
};

export const readCursor = (cursor) => {
    if (!cursor) return null;
    try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
        return JSON.parse(decoded);
    } catch (err) {
        return null;
    }
};
