

const mockData = [
    {
        id: 1,
        name: "Liquide vaisselle",
        createdBy: {
            id: 1,
            name: "Flo"
        },
        createdAt: "2025-06-05T10:30:00",
        pending: true
    },
    {
        id: 2,
        name: "Pain complet",
        createdBy: {
            id: 1,
            name: "Flo"
        },
        createdAt: "2025-06-07T14:45:00",
        pending: true
    },
    {
        id: 3,
        name: "Lait demi-écrémé",
        createdBy: {
            id: 1,
            name: "Flo"
        },
        createdAt: "2025-06-09T08:15:00",
        pending: true
    },
    {
        id: 4,
        name: "Pâtes spaghetti",
        createdBy: {
            id: 3,
            name: "Willy"
        },
        createdAt: "2025-06-11T16:20:00",
        meal: {
            id: 1,
            name: "Lasagnes"
        },
        pending: true
    },
    {
        id: 5,
        name: "Tomates cerises",
        createdBy: {
            id: 2,
            name: "Julien"
        },
        createdAt: "2025-06-13T12:10:00",
        meal: {
            id: 1,
            name: "Lasagnes"
        },
        pending: true
    },
    {
        id: 6,
        name: "Filet de poulet",
        createdBy: {
            id: 1,
            name: "Flo"
        },
        createdAt: "2025-06-15T18:55:00",
        meal: {
            id: 2,
            name: "Poulet coco",
        },
        pending: true
    },
    {
        id: 7,
        name: "Riz basmati",
        createdBy: {
            id: 1,
            name: "Flo"
        },
        createdAt: "2025-06-17T09:30:00",
        meal: {
            id: 2,
            name: "Poulet coco",
        },
        pending: true
    },
    {
        id: 8,
        name: "Yaourt nature",
        createdBy: {
            id: 1,
            name: "Flo"
        },
        createdAt: "2025-06-19T11:50:00",
        pending: false
    },
    {
        id: 9,
        name: "Pommes de terre",
        createdBy: {
            id: 1,
            name: "Flo"
        },
        createdAt: "2025-06-21T15:25:00",
        pending: false
    },
    {
        id: 10,
        name: "Concombre",
        createdBy: {
            id: 2,
            name: "Julien"
        },
        createdAt: "2025-06-23T13:40:00",
        pending: true
    },
    {
        id: 11,
        name: "Fromage râpé",
        createdBy: {
            id: 2,
            name: "Julien"
        },
        createdAt: "2025-06-25T17:05:00",
        pending: true
    },
    {
        id: 12,
        name: "Jus d'orange",
        createdBy: {
            id: 2,
            name: "Julien"
        },
        createdAt: "2025-06-27T08:55:00"
    },
    {
        id: 13,
        name: "Biscuits apéritif",
        createdBy: {
            id: 2,
            name: "Julien"
        },
        createdAt: "2025-06-28T19:10:00"
    },
    {
        id: 14,
        name: "Café moulu",
        createdBy: {
            id: 2,
            name: "Julien"
        },
        createdAt: "2025-06-29T10:00:00"
    },
    {
        id: 15,
        name: "Chocolat noir",
        createdBy: {
            id: 2,
            name: "Julien"
        },
        createdAt: "2025-06-30T14:35:00"
    }
];


export const getGroceries = ({ query: { page = 0, limit = 10, search = "", onlyPending = false } }) => {

    //TODO: add db
    const items = mockData.filter((item) => {
        if (onlyPending)
            return item.pending
        return true
    });


    return (
        {
            page,
            limit,
            total: items?.length,
            totalPages: Math.ceil(items?.length / limit),
            items 
        }
    );


}