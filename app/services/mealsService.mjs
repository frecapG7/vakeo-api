const mockMeals = [
  {
    id: 1,
    name: "Lasagnes",
    startDate: "2025-08-01T10:00:00.207Z",
    endDate: "2025-08-01T12:00:00.207Z",
    cooks: [1],
    users: [1, 2],
    groceries: [
      {
        id: 1,
        name: "Pâtes",
        quantity: 2,
        unit: "kg",
        checked: true,
        checkedBy: 1,
      },
      {
        id: 2,
        name: "Viande hachée",
        quantity: 1,
        unit: "kg",
        checked: false,
      },
      {
        id: 3,
        name: "Tomates",
        quantity: 1,
        unit: "kg",
        checked: false,
      },
    ],
    rates: [
      {
        userId: 1,
        rate: 2,
      },
      {
        userId: 2,
        rate: 1,
      },
    ],
    rate: 1.5,
  },
  {
    id: 2,
    name: "Bbq",
    startDate: "2025-08-01T18:00:00.207Z",
    endDate: "2025-08-01T22:00:00.207Z",
    cooks: [],
    users: [1, 2, 3],
    groceries: [
      {
        id: 1,
        name: "Viande à griller",
        quantity: 2,
        unit: "kg",
        checked: false,
      },
      {
        id: 2,
        name: "Salade",
        quantity: 1,
        unit: "kg",
        checked: false,
      },
      {
        id: 3,
        name: "Pain à burger",
        quantity: 6,
        unit: "pièces",
        checked: false,
      },
    ],
    rates: [],
    rate: null,
  },
  {
    id: 3,
    name: "Gratin de sardines",
    startDate: "2025-08-02T18:00:00.207Z",
    endDate: "2025-08-02T20:00:00.207Z",
    cooks: [3],
    users: [1, 2, 3],
    groceries: [
      {
        id: 1,
        name: "Sardines",
        quantity: 1,
        unit: "kg",
        checked: false,
      },
      {
        id: 2,
        name: "Pommes de terre",
        quantity: 2,
        unit: "kg",
        checked: false,
      },
      {
        id: 3,
        name: "Crème fraîche",
        quantity: 500,
        unit: "g",
        checked: false,
      },
    ],
    rates: [
      {
        userId: 1,
        rate: 5,
      },
      {
        userId: 2,
        rate: 4,
      },
    ],
    rate: 4.5,
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
      },
      {
        id: 2,
        name: "Julien",
      },
      {
        id: "3",
        name: "Willy",
      },
    ],
  };
};

const toMeal = (meal, trip) => ({
  ...meal,
  cooks: trip.users
    .filter((user) => meal.cooks.includes(user.id))
    .map((user) => ({
      id: user.id,
      name: user.name,
    })),
  users: trip.users
    .filter((user) => meal.users.includes(user.id))
    .map((user) => ({
      id: user.id,
      name: user.name,
    })),
  hasWarning: meal.cooks?.length === 0,
});

export const getMeals = async ({
  params: { id = "" },
  query: { date = "" },
}) => {
  // 1 - Get the trip
  const trip = await getTrip(id);
  // 2 - Get the meals
  return mockMeals.map((meal) => toMeal(meal, trip, date));
};

export const getMeal = async ({ params: { id = "", mealId = "" } }) => {
  // 1 - Get the trip
  const trip = await getTrip(id);
  // 2 - Get the meal
  const meal = mockMeals.find((meal) => meal.id === parseInt(mealId, 10));
  if (!meal) throw new Error("Meal not found");
  return toMeal(meal, trip);
};

export const createMeal = async ({ params: { id = "" }, body }) => {
  // 1 - Get the trip
  const trip = await getTrip(id);
  // 2 - Create the meal
  const meal = {
    ...body,
    id: mockMeals.length + 1,
    cooks: body.cooks || [],
    users: body.users || [],
  };
  mockMeals.push(meal);
  return toMeal(meal, trip);
};
