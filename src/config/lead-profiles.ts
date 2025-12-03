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
            "hotel", "motel", "hostel",
            "pensjonat", "zajazd", "ośrodek wypoczynkowy", "noclegi"
        ]
    },
    restaurants: {
        id: 'restaurants',
        label: 'Restauracje / gastronomia',
        base_score: 30,
        keywords: [
            "restaurant", "steakhouse", "seafood restaurant",
            "fine dining", "grill house", "barbecue restaurant", "pizzeria", "bistro",
            "restauracja", "karczma", "restauracja hotelowa", "tawerna"
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
    agro_farm: {
        id: 'agro_farm',
        label: 'Rolnictwo / Hodowla',
        base_score: 35,
        keywords: [
            "gospodarstwo rolne", "ferma drobiu", "ferma kur",
            "ferma trzody", "ferma bydła", "obora",
            "kurnik", "szklarnia", "uprawa warzyw", "sad", "gospodarstwo ogrodnicze",
            "hodowla", "drób", "trzoda", "producent rolny"
        ]
    },
    agro_meat: {
        id: 'agro_meat',
        label: 'Przetwórstwo mięsne / Masarnie',
        base_score: 35,
        keywords: [
            "masarnia", "zakład mięsny", "ubojnia", "przetwórstwo mięsne",
            "rzeźnia", "wędliniarstwo", "skup żywca"
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
            "druk cyfrowy", "serwerownia",
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
            "biuro"
        ]
    },
    transport: {
        id: 'transport',
        label: 'Firmy transportowe',
        base_score: 40,
        keywords: [
            "transport company", "logistics company", "freight", "trucking", "shipping company",
            "firma transportowa", "usługi transportowe", "spedycja", "przewozy", "transport ciężarowy", "baza transportowa"
        ]
    },
    mushrooms: {
        id: 'mushrooms',
        label: 'Producenci pieczarek',
        base_score: 45,
        keywords: [
            "mushroom farm", "mushroom producer", "fungiculture",
            "pieczarkarnia", "producent pieczarek", "uprawa pieczarek", "hodowla grzybów"
        ]
    },
    footwear: {
        id: 'footwear',
        label: 'Producenci obuwia',
        base_score: 40,
        keywords: [
            "footwear manufacturer", "shoe factory", "shoe maker",
            "producent obuwia", "fabryka obuwia", "zakład obuwniczy", "szewc", "produkcja butów"
        ]
    },
    fruit_veg_processing: {
        id: 'fruit_veg_processing',
        label: 'Przetwórstwo owoców i warzyw',
        base_score: 45,
        keywords: [
            "fruit processing", "vegetable processing", "food processing plant",
            "przetwórstwo owocowo-warzywne", "zakład przetwórstwa", "producent mrożonek", "produkcja soków", "przetwory", "chłodnia owoców"
        ]
    },
    wood_furniture: {
        id: 'wood_furniture',
        label: 'Branża drzewna / meblarska',
        base_score: 40,
        keywords: [
            "furniture manufacturer", "woodworking", "carpentry",
            "producent mebli", "fabryka mebli", "zakład stolarski", "meble na wymiar", "stolarz", "produkcja mebli"
        ]
    },
    packaging: {
        id: 'packaging',
        label: 'Branża opakowań / folii / tworzyw',
        base_score: 40,
        keywords: [
            "packaging manufacturer", "plastic packaging", "plastic factory",
            "producent opakowań", "opakowania foliowe", "tworzywa sztuczne", "produkcja folii", "zakład tworzyw sztucznych", "wtryskownia"
        ]
    },
    windows_doors: {
        id: 'windows_doors',
        label: 'Branża budowlana: okna / drzwi',
        base_score: 40,
        keywords: [
            "window manufacturer", "door manufacturer", "joinery",
            "producent okien", "producent drzwi", "stolarka okienna", "stolarka drzwiowa", "fabryka okien"
        ]
    },
    fitness: {
        id: 'fitness',
        label: 'Branża Fitness',
        base_score: 30,
        keywords: [
            "fitness club", "gym", "sports center", "health club",
            "klub fitness", "siłownia", "centrum sportowe", "klub sportowy", "trening personalny"
        ]
    },
    sawmills: {
        id: 'sawmills',
        label: 'Tartaki / Obróbka drewna',
        base_score: 45,
        keywords: [
            "sawmill", "lumber mill", "wood processing", "timber industry",
            "tartak", "obróbka drewna", "zakład drzewny", "przecieranie drewna", "skład drewna"
        ]
    },
    developers: {
        id: 'developers',
        label: 'Deweloperzy',
        base_score: 50,
        keywords: [
            "real estate developer", "housing developer", "construction company",
            "deweloper", "firma deweloperska", "budownictwo mieszkaniowe", "inwestycje budowlane", "biuro sprzedaży mieszkań"
        ]
    }
} as const;

export type ProfileKey = keyof typeof LEAD_PROFILES;
