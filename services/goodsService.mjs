import Good from "../models/goodModel.mjs";
import { InvalidError, NotFoundError } from "../utils/errors.mjs";
import { verifyUser } from "./validationService.mjs";

export const getGood = async (tripId, goodId) => {
    const good = await Good.findOne({
        _id: goodId,
        trip: tripId,
    }).populate("createdBy event");
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
        query.name = { $regex: search, $options: "i" };

    if (cursor) {
        const [cursorChecked, cursorName, cursorId] = cursor.split("_");

        lastName = cursorName;
        lastChecked = cursorChecked === "true";
        lastId = cursorId;
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
            name: 1
        }
    };

    const goods = await Good.find(query, null, options).populate("createdBy event");
    return goods;
}



export const getSummary = async ({ params: { tripId }, query: {event}, }) => {
    const baseQuery = {
        trip: tripId,
        event,
    }

    const totalCount = await Good.countDocuments(baseQuery);
    const checkedCount = await Good.countDocuments({
        ...baseQuery,
        checked: true
    });
    const goods = await Good.find(baseQuery, null, {
        limit: 4,
    });


    return {
        totalCount,
        checkedCount,
        goods
    }


}

export const getNames = async (tripId, search = "") => {

    const query = {
        trip: tripId,
        name: { $regex: search, $options: "i" }
    };

    const options = {
        limit: 5,
        sort: {
            name: 1
        }
    };

    const goods = await Good.find(query, null, options).distinct("name");
    return goods;
}


export const getCount = async (tripId, event) => {

    const query = {
        trip: tripId,
        ...(event && { event })
    };

    const checkedCount = await Good.countDocuments({
        ...query,
        checked: true
    });

    const totalCount = await Good.countDocuments(query);


    return {
        checkedCount,
        totalCount
    };

}

export const createGood = async (trip, { name, quantity, createdBy, event }) => {

    verifyUser(trip, createdBy);

    const newGood = new Good({
        name: name?.toLowerCase(),
        quantity,
        createdBy,
        ...(event && { event }),
        trip,
    });

    return await newGood.save();
}

export const updateGood = async (good, { name, quantity }) => {
    if (good?.checked)
        throw new InvalidError("Cannot updated checked good");

    good.name = name;
    good.quantity = quantity;
    return good.save();
}


export const checkGood = async (good) => {
    good.checked = !good.checked;
    return good.save();
}