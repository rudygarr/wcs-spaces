import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { allRooms } from '../data/inventory';
import { teamSeasons } from '../data/teams';
import { sportOf, sportVenues, athleticFacilities } from '../data/athletic-venues';
import { useSession } from '../lib/session';

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
        options: ['Transportation (away)', 'Early dismissal (away)', 'AV / scoreboard', 'Athletic trainer', 'Game officials', 'Concessions', 'Security'],
      },
      { kind: 'area', label: 'Notes', placeholder: 'Anything athletics, facilities or security should know' },
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

const ATH_NEEDS = ['AV / scoreboard', 'Athletic trainer', 'Game officials', 'Concessions', 'Security'];

// The Athletics door is interactive (unlike the other config-driven forms): the
// facility picker narrows to the venues a sport actually uses, and disappears
// entirely for away games. Templates beat scrolling 49 rooms.
function AthleticsForm() {
  const [team, setTeam] = useState('');
  const [homeAway, setHomeAway] = useState('');

  const sport = team ? sportOf(team) : '';
  const rec = sport ? sportVenues[sport] : undefined;
  const offCampus = !!sport && !rec;

  const groups = useMemo(() => {
    const used = new Set<string>();
    const g: { label: string; rooms: string[] }[] = [];
    if (rec) {
      g.push({ label: `Recommended for ${sport}`, rooms: rec });
      rec.forEach((r) => used.add(r));
    }
    const ath = athleticFacilities.filter((r) => !used.has(r));
    g.push({ label: team ? 'Other athletics facilities' : 'Athletics facilities', rooms: ath });
    ath.forEach((r) => used.add(r));
    g.push({ label: 'Other campus rooms', rooms: allRooms.filter((r) => !used.has(r)) });
    return g;
  }, [team, sport, rec]);

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
          <div style={{ position: 'relative' }}>
            <select style={{ ...inputStyle, appearance: 'none' }} defaultValue={rec && rec.length === 1 ? rec[0] : ''}>
              <option value="">Select facility…</option>
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.rooms.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {chevron}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
            {!team
              ? 'Pick a team and we’ll surface the right field or court first.'
              : offCampus
                ? `${sport} usually plays off-campus — pick a campus facility only if hosting here.`
                : `Showing ${sport} venues first. Checked for conflicts on submit.`}
          </div>
        </Labeled>
      )}

      <Labeled label="Early dismissal (ED)">
        <input type="text" placeholder="e.g. 2:30 p.m. — when students leave class" style={inputStyle} />
      </Labeled>

      <Labeled label={away ? 'Transportation' : 'Transportation (if students travel)'}>
        <input type="text" placeholder="e.g. 2:45 p.m. bus (Lorenzo) — or none" style={inputStyle} />
      </Labeled>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>Needs — routed to each team</div>
        <div style={{ display: 'grid', gap: 9 }}>
          {ATH_NEEDS.map((o) => (
            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, color: 'var(--text-1)' }}>
              <input type="checkbox" style={{ width: 18, height: 18 }} /> {o}
            </label>
          ))}
        </div>
      </div>

      <Labeled label="Notes">
        <textarea placeholder="Anything athletics, facilities or security should know" rows={3} style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
      </Labeled>
    </>
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
          <span>
            Preview of the request form. Submitting as <b style={{ color: 'var(--text-1)' }}>{user.name}</b> — routes to{' '}
            {active.routesTo ?? 'the approvers'} through the same approve → assign → notify engine as a room booking.
          </span>
        </div>

        <div className="list" style={{ padding: '18px 18px 6px' }}>
          {active.id === 'athletics' ? (
            <AthleticsForm />
          ) : (
            active.fields.map((f) => <FieldView key={f.label} f={f} />)
          )}
          <button
            disabled
            style={{ ...inputStyle, height: 44, background: 'var(--green)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 500, opacity: 0.85, marginBottom: 14 }}
          >
            Submit request
          </button>
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
