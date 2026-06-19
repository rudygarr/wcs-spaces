import type { CSSProperties } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { allRooms } from '../data/inventory';
import { useSession } from '../lib/session';

type Field =
  | { kind: 'text'; label: string; placeholder?: string }
  | { kind: 'area'; label: string; placeholder?: string }
  | { kind: 'select'; label: string; options: string[] }
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
            Preview of the request form. Submitting as <b style={{ color: 'var(--text-1)' }}>{user.name}</b> — routes through the same
            approve → assign → notify engine as a room booking.
          </span>
        </div>

        <div className="list" style={{ padding: '18px 18px 6px' }}>
          {active.fields.map((f) => (
            <FieldView key={f.label} f={f} />
          ))}
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
      <div className="page-sub">One hub, four front doors — every request rides the same approval engine.</div>

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
