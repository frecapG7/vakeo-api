import Good from "../models/goodModel.mjs";
import { InvalidError, NotFoundError } from "../utils/errors.mjs";
import { readCursor, sanitizeSearchText } from "../utils/pagination.mjs";
import { verifyUser } from "./validationService.mjs";

export const getGood = async (tripId, goodId) => {
    const good = await Good.findOne({
        _id: goodId,
        trip: tripId,
    }).populate([
        { path: "createdBy", select: "name avatar" },
        { path: "event", select: "name type" }
    ]);
    if (!good)
        throw new NotFoundError("Cannot find good");

    return good;
}

export const search = async (tripId, { search = "", cursor, limit = 10, event, unchecked = false }) => {
    let query = {
        trip: tripId
    };

    let lastChecked;
    let lastName;
    let lastId;

    if (search)
        query.name = { $regex: sanitizeSearchText(search), $options: "i" };

    if (cursor) {
        try {
            const cursorData = readCursor(cursor);
            lastName = cursorData.name;
            lastChecked = cursorData.checked;
            lastId = cursorData._id;
        } catch (e) {
            // Fallback for legacy underscore-delimited cursors
            const [cursorChecked, cursorName, cursorId] = cursor.split("_");
            lastName = cursorName;
            lastChecked = cursorChecked === "true";
            lastId = cursorId;
        }
    }

    if (lastName && lastId)
        query.$or = [
            { checked: { $gt: lastChecked } },
            { checked: lastChecked, name: { $gt: lastName } },
            { checked: lastChecked, name: lastName, _id: { $gt: lastId } }
        ];

    if (event)
        query.event = event;

    if (unchecked)
        query.checked = false;

    const options = {
        limit,
        sort: {
            checked: 1,
            name: 1,
            _id: 1
        }
    };

    const goods = await Good.find(query, null, options).populate([
        { path: "createdBy", select: "name avatar" },
        { path: "event", select: "name type" }
    ]);
    return goods;
}



export const createGood = async (trip, { name, quantity, quantityNumber, unit, createdBy, event }) => {

    verifyUser(trip, createdBy);

    const newGood = new Good({
        name: name?.toLowerCase(),
        //@deprecated
        quantity,
        quantityNumber,
        unit,
        createdBy,
        ...(event && { event }),
        trip,
    });

    return await newGood.save();
}

export const updateGood = async (good, { name, quantity, quantityNumber, unit }) => {
    if (good?.checked)
        throw new InvalidError("Cannot updated checked good");

    good.name = name?.toLowerCase();
    //@deprecated
    good.quantity = quantity;
    good.quantityNumber = quantityNumber;
    good.unit = unit;
    return await good.save();
}


export const checkGood = async (good) => {
    good.checked = !good.checked;
    return good.save();
}

export const checkMultipleGoods = async (tripId, { event, createdBy }) => {
    const query = { trip: tripId, checked: false };
    if (event) query.event = event;
    if (createdBy) query.createdBy = createdBy;
    return Good.updateMany(query, { checked: true });
}
