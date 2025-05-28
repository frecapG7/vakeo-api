export const getTrip = async ({ params: { id = "" } }) => {
  if (id === 666) throw new Error("Bad Request");
  return {
    name: "Luberon V3",
    startDate: "2025-06-10",
    endDate: "2025-06-20",
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
    owner: 123,
  };
};

export const createTrip = async ({ body }) => {
  console.log(JSON.stringify(body));

  return {
    name: "Luberon V3",
    startDate: "",
    endDate: "",
    users: [
      {
        id: 123,
        name: "Moi",
        avatar: "",
      },
    ],
    owner: 123,
  };
};
