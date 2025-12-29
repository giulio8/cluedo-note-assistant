export const SUSPECTS = [
    { id: 'miss_scarlett', label: 'Miss Scarlett' },
    { id: 'col_mustard', label: 'Col. Mustard' },
    { id: 'mrs_peacock', label: 'Mrs. Peacock' },
    { id: 'prof_plum', label: 'Prof. Plum' },
    { id: 'rev_green', label: 'Rev. Green' },
    { id: 'dr_orchid', label: 'Dr. Orchid' },
] as const;

export const WEAPONS = [
    { id: 'rope', label: 'Corda' },
    { id: 'dagger', label: 'Pugnale' },
    { id: 'wrench', label: 'Chiave Inglese' },
    { id: 'revolver', label: 'Pistola' },
    { id: 'candlestick', label: 'Candeliere' },
    { id: 'lead_pipe', label: 'Tubo di Piombo' },
] as const;

export const ROOMS = [
    { id: 'kitchen', label: 'Cucina' },
    { id: 'dining_room', label: 'Sala da Pranzo' },
    { id: 'lounge', label: 'Soggiorno' },
    { id: 'hall', label: 'Ingresso' },
    { id: 'study', label: 'Studio' },
    { id: 'library', label: 'Biblioteca' },
    { id: 'billiard_room', label: 'Sala da Biliardo' },
    { id: 'conservatory', label: 'Veranda' },
    { id: 'ballroom', label: 'Sala da Ballo' },
] as const;

export const ALL_CARDS = [
    ...SUSPECTS.map(c => ({ ...c, category: 'suspect' as const })),
    ...WEAPONS.map(c => ({ ...c, category: 'weapon' as const })),
    ...ROOMS.map(c => ({ ...c, category: 'room' as const })),
];

export type SuspectId = typeof SUSPECTS[number]['id'];
export type WeaponId = typeof WEAPONS[number]['id'];
export type RoomId = typeof ROOMS[number]['id'];
export type CardId = SuspectId | WeaponId | RoomId;
