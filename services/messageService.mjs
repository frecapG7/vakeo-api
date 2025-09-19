import Message from "../models/messageModel.mjs";

export const createMessage = async (trip, {text = "", user}) => {

    const message = new Message({
        text,
        trip,
        user
    });
    return await message.save();
}

export const search = async (tripId, cursor, limit) => {
     let query = {
        trip: tripId
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
    }).populate("user");

    return messages;
}


export const deleteMessage = async (tripId, messageId, userId) => {
    const message = await Message.findOneAndDelete({
        _id: messageId,
        trip: tripId,
        user: userId
    });
    if(!message)
        throw new Error(`Cannot delete message ${messageId}`)
    return;
}