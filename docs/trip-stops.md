# Trip Stops

## Overview
Trip stops represent destinations or waypoints within a trip. They are embedded in the `Trip` model for performance and simplicity.

## API Endpoints

### List Stops
```
GET /trips/:tripId/stops
```
**Query Params**:
- None

**Response**:
```json
[
  {
    "_id": "stop1",
    "name": "Paris",
    "location": { ... }
  }
]
```

### Get a Stop
```
GET /trips/:tripId/stops/:stopId
```
**Query Params**:
- None

**Response**:
```json
{
  "_id": "stop1",
  "name": "Paris",
  "location": { ... }
}
```

### Create a Stop
```
POST /trips/:tripId/stops
```
**Body**:
```json
{
  "name": "Eiffel Tower",
  "location": { ... }
}
```

### Update a Stop
```
PUT /trips/:tripId/stops/:stopId
```
**Body**:
```json
{
  "name": "Louvre Museum",
  "location": { ... }
}
```

### Delete a Stop
```
DELETE /trips/:tripId/stops/:stopId
```
**Query Params**:
- None

## Frontend Integration

### Example: Fetching Stops
```javascript
const response = await fetch(`/trips/${tripId}/stops`);
const stops = await response.json();
```

### Example: Creating a Stop
```javascript
const response = await fetch(`/trips/${tripId}/stops`, {
  method: "POST",
  body: JSON.stringify({ name: "Louvre", location: {...} }),
});
```

### Example: Excluding Stops from Trip
```javascript
// Default: Stops are excluded
const response = await fetch(`/trips/${tripId}`);

// Opt-in: Include stops
const response = await fetch(`/trips/${tripId}?includeStops=true`);
```

## Notes
- Stops are **embedded** in the trip document (no separate collection).
- Max **50 stops** per trip.
- Use `includeStops=true` in `GET /trips/:id` to fetch stops with the trip.
