import Trip from "../models/tripModel.mjs";
import { NotFoundError} from "../utils/errors.mjs";


export const getTrip = async (id) => {
    const trip = await Trip.findById(id);

    if (!trip)
        throw new NotFoundError(`Cannot find trip with id ${id}`);

    return trip;
}


export const createTrip = async (name, users) => {
    const trip = new Trip({
        name,
        users
    });
    const savedTrip = await trip.save();

    return savedTrip;
}


export const updateTrip = async (id, {name}) => {

    const trip = await Trip.findById(id);
    if(!trip)
        throw new NotFoundError(`Cannot find trip with id ${id}`);


    trip.name = name;

    return await trip.save();
}


export const deleteTrip = async (id) => {

    const trip = await Trip.findByIdAndDelete(id);
    if (!trip)
        throw new NotFoundError(`Cannot find trip to delete with id ${id}`);

    
}