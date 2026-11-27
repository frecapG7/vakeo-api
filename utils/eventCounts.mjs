/**
 * Pure helpers merging per-event counters onto event payloads.
 * The aggregation queries live in eventsService; this module has no DB dependency,
 * which makes it the only testable part of the counting path.
 */

const emptyCounts = () => ({
    messageCount: 0,
    lastMessageAt: null,
    goodsCount: { total: 0, missing: 0 }
});

/**
 * Indexes the two aggregation result sets by event id.
 * @param {Array<object>} messageStats - [{ _id, messageCount, lastMessageAt }]
 * @param {Array<object>} goodStats - [{ _id, total, missing }]
 * @returns {Map<string, object>} counts per event id
 */
export const buildEventCountIndex = (messageStats = [], goodStats = []) => {
    const index = new Map();

    const entryFor = (eventId) => {
        const key = String(eventId);
        if (!index.has(key))
            index.set(key, emptyCounts());
        return index.get(key);
    };

    (messageStats ?? []).forEach((stat) => {
        const entry = entryFor(stat._id);
        entry.messageCount = stat.messageCount ?? 0;
        entry.lastMessageAt = stat.lastMessageAt ?? null;
    });

    (goodStats ?? []).forEach((stat) => {
        const entry = entryFor(stat._id);
        entry.goodsCount = { total: stat.total ?? 0, missing: stat.missing ?? 0 };
    });

    return index;
};

/**
 * Reads the counts of one event. Always returns the full shape (zeros, never
 * undefined) so the client has no missing-field case to handle, and returns a
 * fresh object so callers cannot mutate the index.
 * @param {Map<string, object>} index - built by buildEventCountIndex
 * @param {any} eventId - event id, or null for the general conversation
 */
export const readEventCounts = (index, eventId) => {
    if (eventId == null)
        return emptyCounts();
    const counts = index?.get(String(eventId));
    return counts ? { ...counts, goodsCount: { ...counts.goodsCount } } : emptyCounts();
};
