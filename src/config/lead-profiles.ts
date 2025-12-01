export const LEAD_PROFILES = {
    heavy_industry: {
        id: 'heavy_industry',
        label: 'Przemysł ciężki / produkcja',
        base_score: 60,
        keywords: [
            "factory", "manufacturing", "industrial plant",
            "steel plant", "foundry", "smelter", "cement plant",
            "chemical plant", "meat processing plant",
            "fabryka", "zakład produkcyjny", "zakład przemysłowy",
            "huta", "odlewnia", "cementownia", "zakład chemiczny",
            "zakłady mięsne", "mleczarnia", "wytwórnia"
        ]
    },
    logistics: {
        id: 'logistics',
        label: 'Logistyka / magazyny / chłodnie',
        base_score: 50,
        keywords: [
            "logistics center", "distribution center", "warehouse",
            "logistics park", "industrial park",
            "cold storage", "refrigerated warehouse", "fulfillment center",
            "centrum logistyczne", "centrum dystrybucyjne",
            "park magazynowy", "magazyn wysokiego składowania",
            "chłodnia", "mroźnia", "chłodnia składowa", "park przemysłowy"
        ]
    },
    retail: {
        id: 'retail',
        label: 'Retail / centra handlowe',
        base_score: 45,
        keywords: [
            "shopping mall", "shopping center", "retail park", "outlet center",
            "galeria handlowa", "centrum handlowe",
            "park handlowy", "outlet", "dom handlowy"
        ]
    },
    hotels_spa: {
        id: 'hotels_spa',
        label: 'Hotele / SPA / obiekty noclegowe',
        base_score: 40,
        keywords: [
            "hotel", "resort", "spa resort", "wellness",
            "conference hotel", "conference center", "thermal", "aquapark",
            "hotel spa", "ośrodek wypoczynkowy",
            "pensjonat", "centrum konferencyjne", "termy", "aquapark"
        ]
    },
    restaurants: {
        id: 'restaurants',
        label: 'Restauracje / gastronomia',
        base_score: 30,
        keywords: [
            "restaurant", "steakhouse", "seafood restaurant",
            "fine dining", "grill house", "barbecue restaurant", "pizzeria", "bistro",
            "restauracja", "karczma", "steakhouse",
            "restauracja grill", "restauracja hotelowa", "pizzeria", "bistro", "tawerna"
        ]
    },
    bakeries: {
        id: 'bakeries',
        label: 'Piekarnie / cukiernie / produkcja żywności',
        base_score: 40,
        keywords: [
            "bakery", "industrial bakery", "bread factory",
            "confectionery", "pastry shop",
            "piekarnia", "piekarnia przemysłowa", "cukiernia",
            "zakład piekarniczy", "zakład cukierniczy",
            "ciastkarnia", "produkcja pieczywa"
        ]
    },
    agro: {
        id: 'agro',
        label: 'Rolnictwo / agro / hodowla',
        base_score: 35,
        keywords: [
            "farm", "dairy farm", "poultry farm", "pig farm",
            "cattle farm", "greenhouse", "vegetable farm", "orchard",
            "gospodarstwo rolne", "ferma drobiu", "ferma kur",
            "ferma trzody", "ferma bydła", "obora", "obora bydła",
            "kurnik", "szklarnia", "szklarnie",
            "uprawa warzyw", "sad", "gospodarstwo ogrodnicze"
        ]
    },
    energy_services: {
        id: 'energy_services',
        label: 'Usługi energochłonne',
        base_score: 35,
        keywords: [
            "industrial laundry", "laundry service", "dry cleaning",
            "printing house", "print shop",
            "data center", "server room",
            "car wash", "automatic car wash",
            "pralnia", "pralnia przemysłowa", "pralnia wodna", "magiel",
            "pralnia chemiczna", "drukarnia", "drukarnia offsetowa",
            "druk cyfrowy", "data center", "serwerownia",
            "myjnia samochodowa", "myjnia automatyczna", "myjnia bezdotykowa"
        ]
    },
    services: {
        id: 'services',
        label: 'Usługi ogólne',
        base_score: 15,
        keywords: [
            "hair salon", "barber shop", "beauty salon", "spa",
            "gym", "fitness club", "office", "coworking",
            "fryzjer", "salon fryzjerski", "barber",
            "salon kosmetyczny", "gabinet kosmetyczny",
            "siłownia", "fitness", "klub fitness", "studio treningowe",
            "biuro", "coworking"
        ]
    }
} as const;

export type ProfileKey = keyof typeof LEAD_PROFILES;
