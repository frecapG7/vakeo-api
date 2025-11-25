
import express from "express";
import { getTrip } from "../services/tripService.mjs";
import { checkGood, createGood, getCount, getGood, getNames, search, updateGood } from "../app/services/goodsService.mjs";

const app = express();

app.get("/trips/:tripId/goods", async (req, res) => {
    const { tripId } = req.params;
    const goods = await search(tripId, req.query);

    const prevCursor = goods.length > 0 ? buidCursor(goods[0]) : null;
    const nextCursor = goods.length > 0 ? buidCursor(goods[goods.length - 1]) : null;

    return res.status(200).json({
        nextCursor,
        prevCursor,
        totalResults: goods.length,
        goods
    });
});

app.get("/trips/:tripId/goods/names", async (req, res) => {
    const { tripId } = req.params;
    const { search } = req.query;
    const names = await getNames(tripId, search);
    return res.status(200).json(names);
});


app.get("/trips/:tripId/goods/count", async (req, res) => {
    const { tripId } = req.params;
    const { event } = req.query;

    const count = await getCount(tripId, event);
    return res.status(200).json(count);
})


app.post("/trips/:tripId/goods", async (req, res) => {

    const trip = await getTrip(req.params.tripId);
    const good = await createGood(trip, req.body);
    return res.status(201).json(good);
});

app.put("/trips/:tripId/goods/:goodId", async (req, res) => {
    const { tripId, goodId } = req.params;

    const good = await getGood(tripId, goodId);

    const newGood = await updateGood(good, req.body);
    return res.status(200).json(newGood);
});


app.put("/trips/:tripId/goods/:goodId/checked", async (req, res) => {
    const { tripId, goodId } = req.params;

    const good = await getGood(tripId, goodId); 

    const newGood = await checkGood(good);
    return res.status(200).json(newGood);
});

/****************************************************************
 *                      PROTECTED METHODS
 * **************************************************************
 */
const buidCursor = (good) => {
    return `${good.name}_${good._id}`;
}

export default app;