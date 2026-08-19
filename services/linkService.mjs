import Link from "../models/linkModel.mjs";
import TripStop from "../models/tripStopModel.mjs";
import { InvalidError, NotFoundError } from "../utils/errors.mjs";

export const search = async (tripId, { cursor, limit = 10 }) => {
    let query = { trip: tripId };

    if (cursor) {
        query._id = { $lt: cursor };
    }
    const options = {
        limit,
        sort: { _id: -1 }
    };

    const links = await Link.find(query, null, options);
    return links;
};


export const getLink = async (tripId, id) => {
    const link = await Link.findOne({
        _id: id,
        trip: tripId
    });

    if (!link) {
        throw new NotFoundError("Cannot find link");
    }

    return link;
};


export const createLink = async (trip, { url, title, icon, image, description, type }) => {
    const link = new Link({
        url,
        title,
        icon,
        image,
        description,
        trip: trip._id,
        type
    });

    return await link.save();
};


export const updateLink = async (link, { url, title, icon, image, description, type }) => {
    if (url !== undefined) link.url = url;
    if (title !== undefined) link.title = title;
    if (icon !== undefined) link.icon = icon;
    if (description !== undefined) link.description = description;
    if (image !== undefined) link.image = image;

    return await link.save();
};


export const deleteLink = async (tripId, id) => {
    // 1 - Verify link is not attached to an accomodation
    const stopWithAccommodation = await TripStop.exists({
        accommodation: id,
        trip: tripId
    });

    if (stopWithAccommodation) {
        throw new InvalidError("Cannot delete link: it is used as accommodation in a trip stop");
    }

    const link = await Link.findOneAndDelete({
        _id: id,
        trip: tripId
    });

    if (!link) {
        throw new NotFoundError("Cannot find link");
    }

    return link;
};
