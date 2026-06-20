// Sport-aware facility templates for the Athletics request door.
//
// The whole point: a football game can only happen on one of two fields, and
// nobody schedules basketball in the pool. So instead of making the AD scroll
// through every room on campus, we surface the venue(s) a given sport actually
// uses for a HOME event — pulled straight from how the athletics dept books
// them today.

// On-campus athletics facilities, in rough order of how often they're used.
export const athleticFacilities = [
  'Main Football Field',
  'Warrior Field',
  'Gutierrez Field',
  'Baseball Field',
  'Gym',
  'SAC',
  'Pool',
  'Track',
];

// The template: each sport → the campus venue(s) it plays a home event on.
// Sports left out of this map (Tennis, Beach Volleyball, Golf, Sailing) play
// off-campus, so the form points the user there instead of a campus room.
export const sportVenues: Record<string, string[]> = {
  Football: ['Main Football Field', 'Gutierrez Field'],
  Soccer: ['Warrior Field', 'Gutierrez Field'],
  Lacrosse: ['Warrior Field', 'Gutierrez Field'],
  Basketball: ['Gym', 'SAC'],
  Volleyball: ['Gym', 'SAC'],
  Wrestling: ['SAC', 'Gym'],
  Cheerleading: ['Gym', 'SAC'],
  Swimming: ['Pool'],
  'Track & Field': ['Track'],
  'Cross Country': ['Track'],
  Baseball: ['Baseball Field'],
};

// Roster team names look like "Football - Varsity" or "Beach Volleyball - Girls
// - Middle School"; the sport is always the first segment.
export function sportOf(team: string): string {
  return team.split(' - ')[0].trim();
}
