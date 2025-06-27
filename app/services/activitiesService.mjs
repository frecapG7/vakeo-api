const mockActivities = [
  {
    id: 1,
    name: "Sortie bateau",
    startDate: "2025-08-01T10:00:00Z",
    endDate: "2025-08-01T12:00:00Z",
    users: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 2,
    name: "Baignade",
    startDate: "2025-08-01T16:00:00Z",
    endDate: "2025-08-01T18:00:00Z",
    users: [1, 2, 3],
  },
  {
    id: 3,
    name: "Beau de provence",
    description: "",
    startDate: "",
    endDate: "",
    users: [1, 2, 3, 4, 5, 6],
  },
];

const getTrip = async (id) => {
  return {
    id,
    name: "Luberon v3",
    users: [
      {
        id: 1,
        name: "Flo",
        avatar: "profile.jpg",
      },
      {
        id: 2,
        name: "Julien",
      },
      {
        id: 3,
        name: "Willy",
      },
      {
        id: 4,
        name: "Alice",
      },
      {
        id: 5,
        name: "Bob",
      },
      {
        id: 6,
        name: "Charlie",
      },
    ],
  };
};

const toActivity = (activity, trip) => ({
  ...activity,
  users: trip.users
    .filter((user) => activity.users.includes(user.id))
    .map((user) => ({
      id: user.id,
      name: user.name,
      avatar: user.avatar 
    })),
});

export const getActivities = async ({ params: { id } }) => {
  // 1 - Get the trip
  const trip = await getTrip(id);
  // 2 - Get the activities
  return mockActivities.map((activity) => toActivity(activity, trip));
};

export const getActivity = async ({ params: { id, activityId } }) => {
  // 1 - Get the trip
  const trip = await getTrip(id);

  // 2 - Get the activity
  const activity = mockActivities.find(
    (activity) => activity.id === parseInt(activityId, 10)
  );

  return toActivity(activity, trip);
};

export const createActivity = async ({ params: { id = "" }, body }) => {
  // 1 - Get the trip
  const trip = await getTrip(id);
  // 2 - Create the activity

  const activity = {
    id: mockActivities.length + 1,
    name: body.name,
    description: body.description || "",
    startDate: body.startDate || "",
    endDate: body.endDate || "",
    users: body.users || [],
  };
  mockActivities.push(activity);
  return toActivity(activity, trip);
};

export const updateActivity = async ({
  params: { id = "", activityId },
  body,
}) => {
  // 1 - Get the trip
  const trip = await getTrip(id);

  // 2 - Update the activity
  const activityIndex = mockActivities.findIndex(
    (activity) => activity.id === parseInt(activityId, 10)
  );

  if (activityIndex === -1) {
    throw new Error("Activity not found");
  }

  const updatedActivity = {
    ...mockActivities[activityIndex],
    ...body,
  };

  mockActivities[activityIndex] = updatedActivity;

  return toActivity(updatedActivity, trip);
};

export const deleteActivity = async ({ params: { id = "", activityId } }) => {
  // 1 - Get the trip
  const trip = await getTrip(id);

  // 2 - Delete the activity
  const activityIndex = mockActivities.findIndex(
    (activity) => activity.id === parseInt(activityId, 10)
  );

  if (activityIndex === -1) {
    throw new Error("Activity not found");
  }

  const deletedActivity = mockActivities.splice(activityIndex, 1)[0];

  return toActivity(deletedActivity, trip);
};
