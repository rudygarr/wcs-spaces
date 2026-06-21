import type { Asset } from '../lib/types';

// Seed asset registry. Dates are set relative to DEMO_TODAY (2026-08-20) to give
// a realistic mix of overdue / due-soon / on-track preventive maintenance.
export const seedAssets: Asset[] = [
  {
    id: 'as-1', code: 'WCS-HVAC-001', name: 'Gym Rooftop Unit RTU-1', category: 'HVAC', location: 'Gym',
    serial: 'CARR-48TC-9921', installedAt: '2019-06-01', pmIntervalDays: 30, pmTask: 'Replace air filter & inspect belts',
    lastServiceAt: '2026-07-01',
  },
  {
    id: 'as-2', code: 'WCS-HVAC-002', name: 'Theater Air Handler AH-2', category: 'HVAC', location: 'Lighthouse Theater',
    serial: 'TRANE-TAM9-3310', installedAt: '2018-08-15', pmIntervalDays: 30, pmTask: 'Replace air filter',
    lastServiceAt: '2026-08-10',
  },
  {
    id: 'as-3', code: 'WCS-SAFE-014', name: 'AED — Front Office', category: 'Safety', location: 'Administration',
    serial: 'ZOLL-AEDP-7741', installedAt: '2022-01-10', pmIntervalDays: 30, pmTask: 'Check pads & battery readiness',
    lastServiceAt: '2026-07-25',
  },
  {
    id: 'as-4', code: 'WCS-SAFE-001', name: 'Fire Extinguishers (campus set)', category: 'Safety', location: 'Campus-wide',
    pmIntervalDays: 365, pmTask: 'Annual inspection & tag', lastServiceAt: '2025-11-01',
  },
  {
    id: 'as-5', code: 'WCS-AV-021', name: 'Theater Lighting Rig', category: 'AV', location: 'Lighthouse Theater',
    serial: 'ETC-ION-XE', installedAt: '2020-03-01', pmIntervalDays: 90, pmTask: 'Lamp check & focus, DMX test',
    lastServiceAt: '2026-06-01',
  },
  {
    id: 'as-6', code: 'WCS-AV-008', name: 'ES Gym Projector', category: 'AV', location: 'ES Gym',
    serial: 'EPSON-L730U', installedAt: '2021-09-01', pmIntervalDays: 180, pmTask: 'Clean filter & check lamp hours',
    lastServiceAt: '2026-03-01',
  },
  {
    id: 'as-7', code: 'WCS-KIT-003', name: 'Kitchen Exhaust Hood', category: 'Kitchen', location: 'Cafeteria',
    serial: 'CAPT-ND2-48', installedAt: '2017-07-01', pmIntervalDays: 90, pmTask: 'Degrease & inspect fire suppression',
    lastServiceAt: '2026-05-15',
  },
  {
    id: 'as-8', code: 'WCS-KIT-005', name: 'Walk-in Cooler', category: 'Kitchen', location: 'Cafeteria',
    serial: 'TRST-WIC-10', installedAt: '2017-07-01', pmIntervalDays: 60, pmTask: 'Coil cleaning & temp calibration',
    lastServiceAt: '2026-08-01',
  },
  {
    id: 'as-9', code: 'WCS-ATH-002', name: 'Gym Bleachers (telescopic)', category: 'Athletics', location: 'Gym',
    serial: 'HUSS-MAXAM', installedAt: '2016-05-01', pmIntervalDays: 180, pmTask: 'Safety inspection & lubrication',
    lastServiceAt: '2026-02-20',
  },
  {
    id: 'as-10', code: 'WCS-ATH-007', name: 'Gym Scoreboard', category: 'Athletics', location: 'Gym',
    serial: 'DAKT-BB2102', installedAt: '2019-08-01', pmIntervalDays: 365, pmTask: 'Controller & lamp test',
    lastServiceAt: '2026-01-10',
  },
  {
    id: 'as-11', code: 'WCS-IT-031', name: 'Server Rack UPS', category: 'IT', location: 'Media Center',
    serial: 'APC-SRT3000', installedAt: '2021-02-01', pmIntervalDays: 180, pmTask: 'Battery load test',
    lastServiceAt: '2026-04-01',
  },
  {
    id: 'as-12', code: 'WCS-FAC-004', name: 'Standby Generator', category: 'Facilities', location: 'Facilities Yard',
    serial: 'GENR-RG048', installedAt: '2018-11-01', pmIntervalDays: 90, pmTask: 'Run test, oil & coolant check',
    lastServiceAt: '2026-05-20',
  },
  {
    id: 'as-13', code: 'WCS-FAC-001', name: 'Administration Elevator', category: 'Facilities', location: 'Administration',
    serial: 'OTIS-GEN2', installedAt: '2015-06-01', pmIntervalDays: 90, pmTask: 'State inspection & service',
    lastServiceAt: '2026-07-10',
  },
  {
    id: 'as-14', code: 'WCS-FAC-009', name: 'Hot Water Boiler', category: 'Facilities', location: 'Facilities Yard',
    serial: 'LOCH-FTXL', installedAt: '2017-03-01', pmIntervalDays: 180, pmTask: 'Combustion analysis & flush',
    lastServiceAt: '2026-03-15',
  },
];
