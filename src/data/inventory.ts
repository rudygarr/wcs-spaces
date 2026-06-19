// Harvested from the live Planning Center backend (read-only), 2026-06-19.
// 49 rooms across 11 folders, 37 resources across 7 folders.

export type Folder = { name: string; items: string[] };

export const roomFolders: Folder[] = [
  { name: 'Administration', items: ['TIDE Conference Room'] },
  {
    name: 'Lighthouse PAC',
    items: [
      'Lighthouse Theater',
      'Green Room',
      'White Room',
      'Stagecraft Room',
      'The Lighthouse Studio',
      'Art Gallery',
      'Theatre class room',
      'Band Room',
    ],
  },
  {
    name: 'The Beacon',
    items: [
      'Beacon Hall',
      'Rehearsal Studio (Orchestra Classroom)',
      'B 202 Choir Classroom',
      'B 201 Dance Classroom',
      'Beacon Hallway',
    ],
  },
  { name: 'Fine Arts', items: ['FA 109 (Old Orchestra next to Wrestling room)'] },
  { name: 'Nature Center', items: ['NC101 Classroom', 'Deck', 'NC102 Classroom'] },
  {
    name: 'Wild Acre',
    items: [
      'Briggs Bamboo Forest',
      'Critter Corner',
      'Dans Aviary',
      'Hudson Pond',
      'Munilla Fire Pit Amphitheater',
      'Obstacle Course',
      'Overlook Tower',
      'Perez Timber Village',
      'Tortoise Habitat',
    ],
  },
  { name: 'Athletics', items: ['Gutierrez Field', 'Gym', 'SAC', 'Pool', 'Main Football Field', 'Track'] },
  { name: 'Elementary School', items: ['ES Courtyard/Field', 'ES Classrooms', 'Food Truck Pavilion', 'ES Gym'] },
  {
    name: 'Media Center',
    items: [
      'LC1 - HS/MS Learning Commons Quiet Area 1 (East room)',
      'HS/MS Learning Commons Lounge Area',
      'LC2 - HS/MS Learning Commons Quiet Area 2 (Middle room)',
    ],
  },
  { name: 'High School', items: ['Central Courtyard/Concourse', 'HS Classrooms', 'HS Classrooms (Science)'] },
  {
    name: 'Middle School',
    items: ['6th Grade Wing', 'MS Conference Room', 'MS Media Center Classrooms', '7th Grade Wing', '8th Grade Wing', 'MS Courtyard'],
  },
];

export const resourceFolders: Folder[] = [
  {
    name: 'Maintenance',
    items: [
      'Table (rectangle)',
      'Student Chairs',
      'Chairs',
      'Table (round)',
      'Podium',
      'Bleacher seating',
      'Table (cafeteria-style)',
      'Big Fan (Box Fan)',
      'onsite maintenance personnel',
      'Clear Floor (no tables, no chairs)',
      'Gym floor carpeting',
      'Tent',
    ],
  },
  {
    name: 'Sound/Lights/Staging',
    items: [
      'Choral (Rolling) Risers',
      'Platforms',
      'Band Shell',
      'Microphone (hand-held)',
      'LED Screen',
      'Projector Screen',
      'Sound Technician',
      'Microphone (headset)',
      'Light Technician',
      'Portable Microphone/Speaker',
      'Choir Mics',
      'Rudy Garrido',
    ],
  },
  { name: 'IT', items: ['Projector/Screen', 'TV', 'Owl Camera', 'GYM or SAC ONLY - Microphone (handheld)'] },
  {
    name: 'Transportation',
    items: [
      'Warrior Big Bus 1 (40 plus driver)',
      'Warrior Big Bus 2 (27 plus driver)',
      'Warrior Bus 3 (28 plus driver)',
      'Warrior Bus 4 (25 plus driver)',
      'Warrior Suburban (7 plus driver)',
      'Van',
    ],
  },
  { name: 'Custodial/Cleaning', items: ['Cleaning'] },
  { name: 'Catering', items: ['Catering'] },
  { name: 'Administration', items: ['Security'] },
];

export const allRooms: string[] = roomFolders.flatMap((f) => f.items);
export const allResources: string[] = resourceFolders.flatMap((f) => f.items);

export function folderOfRoom(room: string): string | undefined {
  return roomFolders.find((f) => f.items.includes(room))?.name;
}
