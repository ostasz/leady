
const LEAD_PROFILES = {
    restaurants: { id: 'restaurants', label: 'Restauracje', keywords: [] },
    agro_meat: { id: 'agro_meat', label: 'Masarnie', keywords: [] }
};


function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

const profiles = ['restaurants', 'agro_meat'];

profiles.forEach(profileKey => {
    const isAgro = profileKey.includes('agro');
    const radius = isAgro ? 50000 : 20000;
    console.log(`Profile: ${profileKey}, IsAgro: ${isAgro}, Radius: ${radius}m`);

    // Test distance filter
    const center = { lat: 51.4027, lng: 21.1471 }; // Radom
    const farPlace = { lat: 51.8616, lng: 20.8676 }; // Grójec (~50km away)

    const dist = calculateDistance(center.lat, center.lng, farPlace.lat, farPlace.lng);
    const isWithin = dist <= (radius / 1000);

    console.log(`  Distance to Grójec: ${dist.toFixed(2)}km. Within radius? ${isWithin}`);
});
