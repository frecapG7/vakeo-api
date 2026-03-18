
import { geocode as nominatimGeocode } from "./nominatim.mjs";
import { geocode as mapGeocode } from "./mapbox.mjs";



let geocode = nominatimGeocode;


export const setGeocodingProvider = (provider) => {
    if (provider === "mapbox")
        geocode = mapGeocode
    else
        geocode = nominatimGeocode;
}


export { geocode };

