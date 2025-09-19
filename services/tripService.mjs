import Trip from "../models/tripModel.mjs";
import { InvalidError, NotFoundError } from "../utils/errors.mjs";

export const getTrip = async (id) => {
    const trip = await Trip.findById(id);

    if (!trip)
        throw new NotFoundError(`Cannot find trip with id ${id}`);

    return trip;
}


export const createTrip = async (name, users, image) => {
    const trip = new Trip({
        name,
        users,
        image
    });
    const savedTrip = await trip.save();

    return savedTrip;
}


export const updateTrip = async (trip, { name, image, startDate, endDate }) => {


    verifyDates(startDate, endDate);

    trip.name = name;
    trip.image = image;
    trip.startDate = startDate;
    trip.endDate = endDate;

    return await trip.save();
}


export const deleteTrip = async (id) => {

    const trip = await Trip.findByIdAndDelete(id);
    if (!trip)
        throw new NotFoundError(`Cannot find trip to delete with id ${id}`);
}



const verifyDates = (startDate, endDate) => {
    const hasStartDate = !!startDate;
    const hasEndDate = !!endDate;

    if (!hasStartDate && !hasEndDate) return;

    if (hasStartDate !== hasEndDate) {
        throw new InvalidError("Cannot update startDate or endDate individually: both must be provided or omitted together.");
    }

    if (startDate > endDate) {
        throw new InvalidError("Cannot update startDate after endDate");
    }
}