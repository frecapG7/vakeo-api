import { InvalidError } from "../../utils/errors.mjs";


export const verifyDates = (startDate, endDate) => {
    const hasStartDate = !!startDate;
    const hasEndDate = !!endDate;

    if (!hasStartDate && !hasEndDate) return;

    if (hasStartDate !== hasEndDate) {
        throw new InvalidError("StartDate and endDate both must be provided or omitted together.");
    }

    if (startDate > endDate) {
        throw new InvalidError("startDate cannot be after endDate");
    }
}


export const verifyUser = (trip, user) => {
    if (!trip.users.includes(user._id))
        throw new Error(`Users ${user._id} is not part of trip ${trip._id}`);

}