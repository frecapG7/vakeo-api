const mock = [
  {
    id: 1,
    title: "Tricount",
    url: "https://tricount.com/teLoFFfssFQqpAhkbJ",
    type: "budget",
  },
  {
    id: 2,
    title: "Airbnb",
    url: "https://www.airbnb.com/rooms/12345678",
    type: "housing",
  },
  {
    id: 3,
    title: "Motocross",
    url: "https://www.motocroo-95-explore.fr/itemms/234234",
    type: "others",
  },
];

export const searchLinks = async ({ params: { id = 0 }, query: { types } }) => {
  const typeFilter = types?.split(",").map((type) => type.trim()) || [];
  console.log("typeFilter", typeFilter);

  return mock.filter(
    (link) => typeFilter?.length === 0 || typeFilter?.includes(link.type)
  );
};
