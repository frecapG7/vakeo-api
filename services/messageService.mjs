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
        event,
        readBy: [{ user }]
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

    const messages = await Message.find(query, 'text createdAt readBy', {
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
    return;
}

export const markAllMessagesAsRead = async (tripId, eventId = null, userId) => {
    const filter = { 
        trip: tripId,
        event: eventId
    
    };
    await Message.updateMany(
        {
            ...filter,
            readBy: { $not: { $elemMatch: { user: userId } } }
        },
        {
            $push: { readBy: { user: userId } }
        }
    );
};

export const getUnreadConversationCount = async (tripId, userId) => {
    const tripObjectId = mongoose.Types.ObjectId.isValid(tripId)
        ? new mongoose.Types.ObjectId(tripId)
        : tripId;

    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

    const conversationsWithUnread = await Message.aggregate([
        { $match: { trip: tripObjectId } },
        {
            $group: {
                _id: "$event",
                hasUnread: {
                    $sum: {
                        $cond: [
                            {
                                $eq: [
                                    { $size: {
                                        $filter: {
                                            input: { $ifNull: ["$readBy", []] },
                                            as: "r",
                                            cond: { $eq: ["$$r.user", userObjectId] }
                                        }
                                    }},
                                    0
                                ]
                            },
                            1,
                            0
                        ]
                    }
                }
            }
        },
        { $match: { hasUnread: { $gt: 0 } } },
        { $count: "count" }
    ]);

    return conversationsWithUnread.length > 0 ? conversationsWithUnread[0].count : 0;
}


export const getHubConversations = async (tripId, userId = null) => {
    const tripObjectId = mongoose.Types.ObjectId.isValid(tripId)
        ? new mongoose.Types.ObjectId(tripId)
        : tripId;

    const unreadMatch = userId
        ? { $not: { $elemMatch: { "readBy.user": new mongoose.Types.ObjectId(userId) } } }
        : { $expr: false };

    const unreadCondition = userId
        ? {
            "readBy": {
                $not: {
                    $elemMatch: {
                        user: new mongoose.Types.ObjectId(userId)
                    }
                }
            }
        }
        : {};

    const results = await Message.aggregate([
        { $match: { trip: tripObjectId } },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: "$event",
                lastMessage: { $first: "$$ROOT" },
                lastMessageUserId: { $first: "$user" }
            }
        },
        {
            $lookup: {
                from: "events",
                localField: "_id",
                foreignField: "_id",
                as: "eventData"
            }
        },
        {
            $lookup: {
                from: "tripusers",
                localField: "lastMessageUserId",
                foreignField: "_id",
                as: "userData"
            }
        },
        {
            $lookup: {
                from: "messages",
                let: { eventId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$trip", tripObjectId] },
                                    { $eq: ["$event", "$$eventId"] },
                                ]
                            },
                            ...unreadCondition
                        }
                    },
                    { $count: "count" }
                ],
                as: "unread"
            }
        },
        { $unwind: { path: "$eventData", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },
        { $sort: { "lastMessage.createdAt": -1 } },
        {
            $project: {
                _id: 0,
                conversationId: "$_id",
                title: { $ifNull: ["$eventData.name", "General"] },
                lastMessage: "$lastMessage.text",
                lastMessageDate: "$lastMessage.createdAt",
                lastMessageUser: "$userData",
                unreadCount: { $ifNull: [{ $arrayElemAt: ["$unread.count", 0] }, 0] }
            }
        }
    ]);

    if (!userId) {
        return results.map(({ unreadCount, ...rest }) => rest);
    }

    return results;
}