import TripUser from "../models/tripUserModel.mjs";


export const getTripUserById = async (id) => {
    return await TripUser.findById(id);
}

export const createTripUsers = async (users = []) => {


    const newUsers = users.map(async (user) => createTripUser(user));
    const savedUsers = await Promise.all(newUsers);
    return savedUsers;
}



export const createTripUser = async (user) => {
    const newUser = buildTripUser(user);
    return await newUser.save()
}


export const buildTripUser = ({name, avatar}) => {
    return new TripUser({
        name,
        avatar,
    });
}