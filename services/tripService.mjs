import Trip from "../models/tripsModel.mjs";





export const getTrip = async (id) => {
    const trip = await Trip.findById(id);

    if (!trip)
        throw new Error(`Cannot find trip with id ${id}`);

    return trip;
}


export const createTrip = async ({ name }) => {

    const trip = new Trip({
        name
    });

    const savedTrip = await trip.save();

    return savedTrip;
}



export const deleteTrip = async (id) => {

    const trip = await Trip.findByIdAndDelete(id);
    if (!trip)
        throw new Error(`Cannot find trip to delete with id ${id}`);

    
}