import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { allRooms, roomFolders } from '../data/inventory';
import { teamSeasons, teamLevel, type TeamLevel } from '../data/teams';
import { sportOf, sportVenues, athleticFacilities } from '../data/athletic-venues';
import { useSession } from '../lib/session';
import { useStore } from '../lib/store';
import type { Department } from '../lib/types';

type Field =
  | { kind: 'text'; label: string; placeholder?: string }
  | { kind: 'area'; label: string; placeholder?: string }
  | { kind: 'select'; label: string; options: string[] }
  | { kind: 'teamselect'; label: string }
  | { kind: 'checks'; label: string; options: string[] }
  | { kind: 'date'; label: string }
  | { kind: 'check'; label: string }
  | { kind: 'file'; label: string };

interface Door {
  id: string;
  cls: string;
  icon: string;
  title: string;
  blurb: string;
  replaces: string;
  routesTo?: string;
  fields: Field[];
}

const doors: Door[] = [
  {
    id: 'book',
    cls: 't-book',
    icon: 'ti-calendar-plus',
    title: 'Book a space',
    blurb: 'Reserve any room or resource and route it for approval.',
    replaces: 'Planning Center Calendar',
    fields: [
      { kind: 'text', label: 'Event name', placeholder: 'e.g. Fall Drama Rehearsal' },
      { kind: 'select', label: 'Room', options: allRooms },
      { kind: 'date', label: 'Date & time' },
      { kind: 'text', label: 'Setup / teardown', placeholder: '30 min before / after' },
      { kind: 'text', label: 'Resources needed', placeholder: 'Sound tech, podium…' },
      { kind: 'check', label: 'Expecting outside visitors' },
      { kind: 'area', label: 'Notes', placeholder: 'Anything security or facilities should know' },
    ],
  },
  {
    id: 'maintenance',
    cls: 't-maint',
    icon: 'ti-tool',
    title: 'Report maintenance',
    blurb: 'Something broken or needs setup? Send it to facilities.',
    replaces: 'Asset Essentials (Brightly)',
    fields: [
      { kind: 'select', label: 'Work category', options: ['Plumbing', 'Electrical', 'HVAC', 'Furniture / setup', 'Grounds', 'General'] },
      { kind: 'select', label: 'Location', options: allRooms },
      { kind: 'text', label: 'Area / room number', placeholder: 'e.g. 204' },
      { kind: 'area', label: 'Work requested', placeholder: 'Describe the issue' },
      { kind: 'file', label: 'Photo of the problem' },
    ],
  },
  {
    id: 'it',
    cls: 't-it',
    icon: 'ti-device-laptop',
    title: 'IT request',
    blurb: 'Projector down? Login issue? Open a ticket with IT.',
    replaces: 'Incident / IT Direct (Brightly)',
    fields: [
      { kind: 'select', label: 'Location', options: ['Elementary School', 'Middle School', 'High School'] },
      { kind: 'select', label: 'Area', options: ['Auditorium', 'Classroom', 'Computer Lab', 'Conference Room', 'Data Closet', 'Library', 'Office'] },
      { kind: 'text', label: 'Room number', placeholder: 'e.g. 112' },
      { kind: 'select', label: 'Problem type', options: ['Hardware', 'Software / login', 'Network / Wi-Fi', 'AV / projector', 'Other'] },
      { kind: 'check', label: 'This is an emergency' },
      { kind: 'area', label: 'Describe the problem', placeholder: 'What’s happening?' },
    ],
  },
  {
    id: 'athletics',
    cls: 't-ath',
    icon: 'ti-ball-basketball',
    title: 'Athletics event',
    blurb: 'Schedule a game, practice or tournament — home or away.',
    replaces: 'Athletic calendar (Blackbaud)',
    routesTo: 'the Athletic Director',
    fields: [
      { kind: 'select', label: 'Event type', options: ['Game', 'Practice', 'Scrimmage', 'Tournament', 'Tryout', 'Other'] },
      { kind: 'teamselect', label: 'Team' },
      { kind: 'select', label: 'Home or Away', options: ['Home', 'Away'] },
      { kind: 'text', label: 'Opponent', placeholder: 'e.g. Pine Crest School' },
      { kind: 'date', label: 'Date & time' },
      { kind: 'select', label: 'Facility (home events — checked for conflicts)', options: allRooms },
      { kind: 'text', label: 'Early dismissal (ED)', placeholder: 'e.g. 2:30 p.m. — when students leave class' },
      { kind: 'text', label: 'Transportation', placeholder: 'e.g. 2:45 p.m. bus (Lorenzo) — or none' },
      {
        kind: 'checks',
        label: 'Needs — routed to each team',
        options: ['Transportation (away)', 'Early dismissal (away)', 'AV / scoreboard', 'Announcer (PA)', 'Athletic trainer', 'Game officials', 'Concessions', 'Security'],
      },
      { kind: 'area', label: 'Notes', placeholder: 'Anything athletics, facilities or security should know' },
    ],
  },
  {
    id: 'rental',
    cls: 't-rental',
    icon: 'ti-building-community',
    title: 'Rent a facility',
    blurb: 'Outside group? Request to use a WCS space.',
    replaces: 'Facilitron / Communal',
    routesTo: 'the rentals office',
    fields: [
      { kind: 'text', label: 'Organization', placeholder: 'e.g. Grace Community Church' },
      { kind: 'text', label: 'Contact name', placeholder: 'Your name' },
      { kind: 'text', label: 'Email', placeholder: 'you@org.com' },
      { kind: 'text', label: 'Phone', placeholder: 'Optional' },
      { kind: 'select', label: 'Space requested', options: allRooms },
      { kind: 'date', label: 'Date & time' },
      { kind: 'text', label: 'Expected attendance', placeholder: '# of people' },
      { kind: 'area', label: 'Event description', placeholder: 'What are you hosting?' },
      { kind: 'file', label: 'Certificate of insurance (COI)' },
      { kind: 'check', label: 'We will provide a certificate of insurance naming WCS' },
    ],
  },
  {
    id: 'visitor',
    cls: 't-visit',
    icon: 'ti-id',
    title: 'Log a visitor',
    blurb: 'Check a guest in at the gate and notify their host.',
    replaces: 'Microsoft Form',
    fields: [
      { kind: 'date', label: 'Date & time of visit' },
      { kind: 'text', label: "Visitor's name(s)", placeholder: 'Full name' },
      { kind: 'select', label: 'Visiting which campus / office', options: ['PS/ES Campus', 'MS Campus', 'HS Campus', 'College & Career Counseling', 'Office', 'Other'] },
      { kind: 'area', label: 'Reason for visit', placeholder: 'Purpose' },
      { kind: 'text', label: 'Personnel overseeing visit', placeholder: 'Staff host' },
    ],
  },
];

const inputStyle: CSSProperties = {
  width: '100%',
  height: 40,
  borderRadius: 'var(--r-sm)',
  border: '0.5px solid var(--border-2)',
  background: 'var(--surface)',
  color: 'var(--text-1)',
  padding: '0 12px',
  fontSize: 15,
  fontFamily: 'inherit',
};

function FieldView({ f }: { f: Field }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>{f.label}</div>
      {f.kind === 'area' ? (
        <textarea placeholder={f.placeholder} rows={3} style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
      ) : f.kind === 'select' ? (
        <div style={{ position: 'relative' }}>
          <select style={{ ...inputStyle, appearance: 'none' }}>
            <option value="">Select…</option>
            {f.options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <i className="ti ti-chevron-down" style={{ position: 'absolute', right: 12, top: 12, color: 'var(--text-3)', pointerEvents: 'none' }} />
        </div>
      ) : f.kind === 'teamselect' ? (
        <div style={{ position: 'relative' }}>
          <select style={{ ...inputStyle, appearance: 'none' }}>
            <option value="">Select team…</option>
            {teamSeasons.map((s) => (
              <optgroup key={s.season} label={s.season}>
                {s.teams.map((t) => (
                  <option key={s.season + t}>{t}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <i className="ti ti-chevron-down" style={{ position: 'absolute', right: 12, top: 12, color: 'var(--text-3)', pointerEvents: 'none' }} />
        </div>
      ) : f.kind === 'checks' ? (
        <div style={{ display: 'grid', gap: 9 }}>
          {f.options.map((o) => (
            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, color: 'var(--text-1)' }}>
              <input type="checkbox" style={{ width: 18, height: 18 }} /> {o}
            </label>
          ))}
        </div>
      ) : f.kind === 'check' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, color: 'var(--text-1)' }}>
          <input type="checkbox" style={{ width: 18, height: 18 }} /> {f.label}
        </div>
      ) : f.kind === 'file' ? (
        <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)' }}>
          <i className="ti ti-camera" /> Add photo
        </div>
      ) : f.kind === 'date' ? (
        <input type="datetime-local" style={inputStyle} />
      ) : (
        <input type="text" placeholder={f.placeholder} style={inputStyle} />
      )}
    </label>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

const chevron = (
  <i className="ti ti-chevron-down" style={{ position: 'absolute', right: 12, top: 12, color: 'var(--text-3)', pointerEvents: 'none' }} />
);

// Each athletics "need" is its own collapsible request, pre-opened by the
// situation: at a HOME game you host (trainer, officials, AV, concessions,
// security) so those open and transportation stays closed; AWAY you only
// travel, so transportation opens and the rest collapse (the host provides
// them) — still expandable if you want to bring your own.
interface Need {
  key: string;
  label: string;
  icon: string;
  hint: string;
  placeholder: string;
  openHome: boolean;
  openAway: boolean;
}
const NEEDS: Need[] = [
  { key: 'transport', label: 'Transportation', icon: 'ti-bus', hint: 'Bus/van, departure time and driver.', placeholder: 'e.g. 2:45 p.m. — Warrior Big Bus 1 (Lorenzo)', openHome: false, openAway: true },
  { key: 'trainer', label: 'Athletic trainer', icon: 'ti-first-aid-kit', hint: 'On-site trainer (the host usually provides one).', placeholder: 'Assign from training staff, or name', openHome: true, openAway: false },
  { key: 'officials', label: 'Game officials / referees', icon: 'ti-whistle', hint: 'Refs/umpires — booked by the home team.', placeholder: 'e.g. 3 officials via county assignor', openHome: true, openAway: false },
  { key: 'av', label: 'AV / scoreboard', icon: 'ti-device-tv', hint: 'Scoreboard, PA, livestream.', placeholder: 'Scoreboard + PA; livestream?', openHome: true, openAway: false },
  { key: 'announcer', label: 'Announcer (PA)', icon: 'ti-microphone', hint: 'PA announcer to call the game — usual for varsity, optional for JV, rare for middle school.', placeholder: 'Who announces? (booster, staff, student)', openHome: true, openAway: false },
  { key: 'concessions', label: 'Concessions', icon: 'ti-cup', hint: 'Snack bar / booster table.', placeholder: 'Open snack bar; who staffs it?', openHome: true, openAway: false },
  { key: 'security', label: 'Security', icon: 'ti-shield', hint: 'Gate and crowd coverage.', placeholder: '# guards / gate coverage', openHome: true, openAway: false },
];

// A few needs default-open by competition level, not just home/away. Announcer
// is typical for varsity, optional for JV, rare for middle school — so it only
// pre-opens for a varsity home game (still expandable for JV/MS).
function needOpensByDefault(n: Need, homeAway: string, level: TeamLevel): boolean {
  const base = homeAway === 'Away' ? n.openAway : n.openHome;
  if (n.key === 'announcer') return homeAway === 'Home' && level === 'Varsity';
  return base;
}

function NeedsAccordion({ homeAway, level }: { homeAway: string; level: TeamLevel }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(NEEDS.map((n) => [n.key, false])));

  // Re-seed which needs are expanded whenever Home/Away or team level changes.
  useEffect(() => {
    if (!homeAway) return;
    setOpen(Object.fromEntries(NEEDS.map((n) => [n.key, needOpensByDefault(n, homeAway, level)])));
  }, [homeAway, level]);

  const note = !homeAway
    ? 'Pick Home or Away and we’ll open the needs that usually apply.'
    : homeAway === 'Away'
      ? 'Away game — only travel is open. Expand anything extra you want to bring.'
      : 'Home game — the needs you host are open. Collapse any you don’t need.';

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>Needs — each opens its own tracked request</div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 9 }}>{note}</div>
      <div className="needs">
        {NEEDS.map((n) => {
          const isOpen = open[n.key];
          return (
            <div className={'need' + (isOpen ? ' open' : '')} key={n.key}>
              <button type="button" className="need-head" onClick={() => setOpen((o) => ({ ...o, [n.key]: !o[n.key] }))}>
                <i className={'ti ' + (isOpen ? 'ti-chevron-down' : 'ti-chevron-right') + ' need-chev'} />
                <i className={'ti ' + n.icon + ' need-ico'} />
                <span className="need-name">{n.label}</span>
                <span className={'need-status ' + (isOpen ? 'on' : 'off')}>{isOpen ? 'Requesting' : 'Not needed'}</span>
              </button>
              {isOpen && (
                <div className="need-body">
                  <div className="need-hint">{n.hint}</div>
                  <input type="text" placeholder={n.placeholder} style={inputStyle} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FacRow({ r, sel, star, onPick }: { r: string; sel: boolean; star?: boolean; onPick: (r: string) => void }) {
  return (
    <button type="button" className={'fac-row' + (sel ? ' sel' : '')} onClick={() => onPick(r)}>
      {star && <i className="ti ti-star-filled" style={{ color: 'var(--gold)', fontSize: 13 }} />}
      <span style={{ flex: 1 }}>{r}</span>
      {sel && <i className="ti ti-check" style={{ color: 'var(--green)' }} />}
    </button>
  );
}

// Custom facility dropdown for athletics: shows only the athletics facilities
// (with this sport's venues recommended on top), and hides every other campus
// room behind a single "Other campus rooms" expander — because 99% of the time
// the athletics facilities are all they need.
function FacilityPicker({ team }: { team: string }) {
  const [open, setOpen] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [selected, setSelected] = useState('');

  const sport = team ? sportOf(team) : '';
  const rec = (sport ? sportVenues[sport] : undefined) ?? [];
  const recSet = new Set(rec);
  const athOther = athleticFacilities.filter((r) => !recSet.has(r));
  const inAth = new Set(athleticFacilities);
  const otherFolders = roomFolders
    .map((f) => ({ name: f.name, items: f.items.filter((r) => !inAth.has(r)) }))
    .filter((f) => f.items.length > 0);

  function choose(r: string) {
    setSelected(r);
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer' }}
      >
        <span style={{ color: selected ? 'var(--text-1)' : 'var(--text-3)' }}>{selected || 'Select facility…'}</span>
        <i className="ti ti-chevron-down" style={{ color: 'var(--text-3)' }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div className="fac-pop">
            {rec.length > 0 && (
              <div className="fac-group">
                <div className="fac-head">Recommended for {sport}</div>
                {rec.map((r) => (
                  <FacRow key={r} r={r} sel={selected === r} star onPick={choose} />
                ))}
              </div>
            )}
            <div className="fac-group">
              <div className="fac-head">Athletics facilities</div>
              {athOther.map((r) => (
                <FacRow key={r} r={r} sel={selected === r} onPick={choose} />
              ))}
            </div>
            <button type="button" className="fac-other" onClick={() => setShowOther((s) => !s)}>
              <i className={'ti ' + (showOther ? 'ti-chevron-down' : 'ti-chevron-right')} />
              Other campus rooms
              <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 12 }}>{showOther ? 'Hide' : 'Show'}</span>
            </button>
            {showOther &&
              otherFolders.map((f) => (
                <div className="fac-group" key={f.name}>
                  <div className="fac-head">{f.name}</div>
                  {f.items.map((r) => (
                    <FacRow key={r} r={r} sel={selected === r} onPick={choose} />
                  ))}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

// The Athletics door is interactive (unlike the other config-driven forms): the
// facility picker narrows to the venues a sport actually uses, and disappears
// entirely for away games. Templates beat scrolling 49 rooms.
function AthleticsForm() {
  const [team, setTeam] = useState('');
  const [homeAway, setHomeAway] = useState('');

  const sport = team ? sportOf(team) : '';
  const rec = sport ? sportVenues[sport] : undefined;
  const offCampus = !!sport && !rec;
  const away = homeAway === 'Away';

  return (
    <>
      <Labeled label="Event type">
        <div style={{ position: 'relative' }}>
          <select style={{ ...inputStyle, appearance: 'none' }}>
            <option value="">Select…</option>
            {['Game', 'Practice', 'Scrimmage', 'Tournament', 'Tryout', 'Other'].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          {chevron}
        </div>
      </Labeled>

      <Labeled label="Team">
        <div style={{ position: 'relative' }}>
          <select value={team} onChange={(e) => setTeam(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
            <option value="">Select team…</option>
            {teamSeasons.map((s) => (
              <optgroup key={s.season} label={s.season}>
                {s.teams.map((t) => (
                  <option key={s.season + t}>{t}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {chevron}
        </div>
      </Labeled>

      <Labeled label="Home or Away">
        <div style={{ position: 'relative' }}>
          <select value={homeAway} onChange={(e) => setHomeAway(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
            <option value="">Select…</option>
            <option>Home</option>
            <option>Away</option>
          </select>
          {chevron}
        </div>
      </Labeled>

      <Labeled label="Opponent">
        <input type="text" placeholder="e.g. Pine Crest School" style={inputStyle} />
      </Labeled>

      <Labeled label="Date & time">
        <input type="datetime-local" style={inputStyle} />
      </Labeled>

      {away ? (
        <div className="banner" style={{ background: 'var(--surface-2)', borderColor: 'transparent', color: 'var(--text-2)', marginBottom: 14 }}>
          <i className="ti ti-bus" style={{ color: 'var(--text-3)' }} />
          <span>Away game — played at the opponent’s venue, so no campus facility is needed. Just set transportation below.</span>
        </div>
      ) : (
        <Labeled label="Facility">
          <FacilityPicker team={team} />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
            {!team
              ? 'Pick a team and we’ll surface the right field or court first.'
              : offCampus
                ? `${sport} usually plays off-campus — pick a campus facility only if hosting here.`
                : `Showing ${sport} venues first. Tap “Other campus rooms” for the full list.`}
          </div>
        </Labeled>
      )}

      <Labeled label="Early dismissal (ED)">
        <input type="text" placeholder="e.g. 2:30 p.m. — when students leave class" style={inputStyle} />
      </Labeled>

      <NeedsAccordion homeAway={homeAway} level={teamLevel(team)} />

      <Labeled label="Notes">
        <textarea placeholder="Anything athletics, facilities or security should know" rows={3} style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
      </Labeled>
    </>
  );
}

function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// A live request form for the Maintenance and IT doors. Deliberately tiny for
// the requester — category, where, what's wrong, an optional photo — and on
// submit it becomes a WorkItem that drops straight into the department queue.
// Industry pattern (Brightly Asset Essentials, Incident IQ): the requester
// never sets priority or assignee; the department triages that side.
function DeptForm({ door, initialLocation }: { door: Door; initialLocation?: string }) {
  const nav = useNavigate();
  const { addWorkItem } = useStore();
  const { user } = useSession();
  const isIT = door.id === 'it';
  const dept: Department = isIT ? 'IT' : 'Maintenance';

  const [category, setCategory] = useState('');
  // Pre-set when arriving from a "Report here" tap on the campus map (S5).
  const [location, setLocation] = useState(initialLocation ?? '');
  const [area, setArea] = useState('');
  const [room, setRoom] = useState('');
  const [problem, setProblem] = useState('');
  const [emergency, setEmergency] = useState(false);
  const [details, setDetails] = useState('');
  const [photo, setPhoto] = useState<string>('');

  const catOpts = isIT
    ? ['Hardware', 'Software / login', 'Network / Wi-Fi', 'AV / projector', 'Other']
    : ['Plumbing', 'Electrical', 'HVAC', 'Furniture / setup', 'Grounds', 'General'];

  const type = isIT ? problem : category;
  const where = isIT ? [location, area, room].filter(Boolean).join(' · ') : [location, room].filter(Boolean).join(' · ');
  const ready = !!type && !!details.trim();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setPhoto(await readPhoto(f));
  }

  function submit() {
    if (!ready) return;
    const item = addWorkItem({
      department: dept,
      type,
      title: `${type}${where ? ' — ' + (isIT ? location : location || room) : ''}`,
      requestedBy: user.name,
      createdAt: new Date().toISOString(),
      status: 'New',
      // Emergencies jump the queue; everything else triaged by the department.
      priority: emergency ? 'Urgent' : 'Normal',
      location: where || undefined,
      details: details.trim(),
      photo: photo || undefined,
    });
    nav('/work/' + item.id);
  }

  return (
    <>
      <Labeled label={isIT ? 'Problem type' : 'Work category'}>
        <div style={{ position: 'relative' }}>
          <select value={isIT ? problem : category} onChange={(e) => (isIT ? setProblem(e.target.value) : setCategory(e.target.value))} style={{ ...inputStyle, appearance: 'none' }}>
            <option value="">Select…</option>
            {catOpts.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          {chevron}
        </div>
      </Labeled>

      <Labeled label="Location">
        <div style={{ position: 'relative' }}>
          <select value={location} onChange={(e) => setLocation(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
            <option value="">Select…</option>
            {(() => {
              const base = isIT ? ['Elementary School', 'Middle School', 'High School'] : allRooms;
              // Honor a location handed in from the map ("Report here") even when
              // it's a building zone rather than a specific room.
              const opts = location && !base.includes(location) ? [location, ...base] : base;
              return opts.map((o) => <option key={o}>{o}</option>);
            })()}
          </select>
          {chevron}
        </div>
      </Labeled>

      {isIT && (
        <Labeled label="Area">
          <div style={{ position: 'relative' }}>
            <select value={area} onChange={(e) => setArea(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
              <option value="">Select…</option>
              {['Auditorium', 'Classroom', 'Computer Lab', 'Conference Room', 'Data Closet', 'Library', 'Office'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            {chevron}
          </div>
        </Labeled>
      )}

      <Labeled label={isIT ? 'Room number' : 'Area / room number'}>
        <input type="text" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. 204" style={inputStyle} />
      </Labeled>

      <Labeled label={isIT ? 'Describe the problem' : 'Work requested'}>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder={isIT ? 'What’s happening?' : 'Describe the issue'} rows={3} style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
      </Labeled>

      {isIT ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, color: 'var(--text-1)', marginBottom: 14 }}>
          <input type="checkbox" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} style={{ width: 18, height: 18 }} /> This is an emergency
        </label>
      ) : (
        <Labeled label="Photo of the problem (optional)">
          <PhotoField photo={photo} onFile={onFile} onClear={() => setPhoto('')} />
        </Labeled>
      )}
      {isIT && (
        <Labeled label="Photo (optional)">
          <PhotoField photo={photo} onFile={onFile} onClear={() => setPhoto('')} />
        </Labeled>
      )}

      <button
        onClick={submit}
        disabled={!ready}
        style={{ ...inputStyle, height: 44, background: 'var(--green)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 500, opacity: ready ? 1 : 0.5, marginBottom: 14, cursor: ready ? 'pointer' : 'default' }}
      >
        Submit to {dept}
      </button>
    </>
  );
}

function PhotoField({ photo, onFile, onClear }: { photo: string; onFile: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void }) {
  if (photo) {
    return (
      <div style={{ position: 'relative', width: 120 }}>
        <img src={photo} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 'var(--r-sm)', border: '0.5px solid var(--border-2)' }} />
        <button onClick={onClear} style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 999, background: 'var(--bad)', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer' }}>
          <i className="ti ti-x" />
        </button>
      </div>
    );
  }
  return (
    <label style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', cursor: 'pointer' }}>
      <i className="ti ti-camera" /> Add photo
      <input type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
    </label>
  );
}

export default function Requests() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { user } = useSession();
  const active = doors.find((d) => d.id === params.get('door'));

  if (active) {
    return (
      <>
        <button
          onClick={() => setParams({})}
          style={{ background: 'none', border: 'none', color: 'var(--info)', fontSize: 15, padding: 0, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <i className="ti ti-chevron-left" /> All requests
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 6 }}>
          <span className={'tile-icon ' + active.cls} style={{ width: 46, height: 46, borderRadius: 14, fontSize: 22 }}>
            <i className={'ti ' + active.icon} />
          </span>
          <div>
            <h1 className="page-h" style={{ fontSize: 24 }}>{active.title}</h1>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Replaces {active.replaces}</div>
          </div>
        </div>

        <div className="banner" style={{ background: 'var(--green-tint)', borderColor: 'transparent', color: 'var(--text-2)', marginTop: 14 }}>
          <i className="ti ti-info-circle" style={{ color: 'var(--green)' }} />
          {active.id === 'maintenance' || active.id === 'it' ? (
            <span>
              Submitting as <b style={{ color: 'var(--text-1)' }}>{user.name}</b> — this drops straight into the{' '}
              {active.id === 'it' ? 'IT' : 'Maintenance'} queue, where the team triages, assigns, and tracks it to done.
            </span>
          ) : (
            <span>
              Preview of the request form. Submitting as <b style={{ color: 'var(--text-1)' }}>{user.name}</b> — routes to{' '}
              {active.routesTo ?? 'the approvers'} through the same approve → assign → notify engine as a room booking.
            </span>
          )}
        </div>

        <div className="list" style={{ padding: '18px 18px 6px' }}>
          {active.id === 'athletics' ? (
            <>
              <AthleticsForm />
              <button
                disabled
                style={{ ...inputStyle, height: 44, background: 'var(--green)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 500, opacity: 0.85, marginBottom: 14 }}
              >
                Submit request
              </button>
            </>
          ) : active.id === 'maintenance' || active.id === 'it' ? (
            <DeptForm door={active} initialLocation={params.get('loc') ?? undefined} />
          ) : (
            <>
              {active.fields.map((f) => <FieldView key={f.label} f={f} />)}
              <button
                disabled
                style={{ ...inputStyle, height: 44, background: 'var(--green)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 500, opacity: 0.85, marginBottom: 14 }}
              >
                Submit request
              </button>
            </>
          )}
        </div>
        <div style={{ height: 16 }} />
      </>
    );
  }

  return (
    <>
      <h1 className="page-h">Requests</h1>
      <div className="page-sub">One hub, five front doors — every request rides the same approval engine.</div>

      <div style={{ display: 'grid', gap: 12 }}>
        {doors.map((d) => (
          <button
            key={d.id}
            onClick={() => (d.id === 'book' ? nav('/book') : setParams({ door: d.id }))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: 'var(--surface)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              padding: '15px 16px',
              textAlign: 'left',
              color: 'var(--text-1)',
            }}
          >
            <span className={'tile-icon ' + d.cls} style={{ width: 48, height: 48, borderRadius: 15, fontSize: 23, flexShrink: 0 }}>
              <i className={'ti ' + d.icon} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em' }}>{d.title}</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.blurb}</span>
            </span>
            <i className="ti ti-chevron-right chev" />
          </button>
        ))}
      </div>
      <div style={{ height: 16 }} />
    </>
  );
}
