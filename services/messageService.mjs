import mongoose from "mongoose";
import Message from "../models/messageModel.mjs";
import Event from "../models/eventModel.mjs";

export const createMessage = async (trip, { text = "", user, event = null }) => {
    // Validate event belongs to trip if provided
    if (event) {
        const count = await Event.countDocuments({ _id: event, trip: trip });
        if (count === 0) {
            throw new Error(`Event ${event} not found or does not belong to trip ${trip}`);
        }
    }

    const message = new Message({
        text,
        trip,
        user,
        event
    });
    return await message.save();
}

export const search = async (tripId, cursor, limit, eventId = null) => {
    let query = {
        trip: tripId,
        event: eventId
    };


    if (cursor)
        query._id = { $lt: cursor }

    if (limit > 100) {
        console.warn("Maximum limit for messages is 100");
        limit = 100;
    }

    const messages = await Message.find(query, 'text createdAt', {
        limit,
        sort: {
            createdAt: -1
        }
    }).populate("user", "name avatar");

    return messages;
}


export const deleteMessage = async (tripId, messageId, userId) => {
    const message = await Message.findOneAndDelete({
        _id: messageId,
        trip: tripId,
        user: userId
    });
    if (!message)
        throw new Error(`Cannot delete message ${messageId}`)
    return;
}

export const getHubConversations = async (tripId) => {
     // Convert tripId to ObjectId if it's a string
    const tripObjectId = mongoose.Types.ObjectId.isValid(tripId)
        ? new mongoose.Types.ObjectId(tripId)
        : tripId;
    // Single efficient aggregation with $lookup to join Event and TripUser
    console.log(tripId);
    const results = await Message.aggregate([
        // Match messages for this trip
        { $match: { trip: tripObjectId  } },
        // Sort by createdAt descending (so $first in group gets latest)
        { $sort: { createdAt: -1 } },
        // Group by event to get latest message per conversation
        {
            $group: {
                _id: "$event",
                lastMessage: { $first: "$$ROOT" },
                lastMessageUserId: { $first: "$user" }
            }
        },
        // Lookup Event data for title
        {
            $lookup: {
                from: "events",
                localField: "_id",
                foreignField: "_id",
                as: "eventData"
            }
        },
        // Lookup TripUser data for user info
        {
            $lookup: {
                from: "tripusers",
                localField: "lastMessageUserId",
                foreignField: "_id",
                as: "userData"
            }
        },
        // Unwind the arrays (they have at most 1 element each)
        { $unwind: { path: "$eventData", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },
        // Sort by lastMessageDate descending
        { $sort: { "lastMessage.createdAt": -1 } },
        // Project final shape
        {
            $project: {
                _id: 0,
                conversationId: "$_id",
                title: { $ifNull: ["$eventData.name", "General"] },
                lastMessage: "$lastMessage.text",
                lastMessageDate: "$lastMessage.createdAt",
                lastMessageUser: "$userData"
            }
        }
    ]);

    return results;
}