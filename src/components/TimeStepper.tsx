import { useRef } from 'react';

// A time field you can either type into OR nudge with up/down arrows — no
// dropdown hunting. Value is "HH:MM" (24h) for storage; the native time input
// shows it in the user's locale and the ▲▼ buttons step by `stepMin` (default
// 15) so "if they don't want to type" they just click.

function addMinutes(value: string, delta: number): string {
  const [h, m] = (value || '00:00').split(':').map(Number);
  let total = (h * 60 + m + delta) % (24 * 60);
  if (total < 0) total += 24 * 60;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

// Snap a typed value to the nearest step when stepping from an off-grid time
// (e.g. 9:07 + step lands on 9:15, not 9:22).
function snap(value: string, stepMin: number, dir: 1 | -1): string {
  const [h, m] = (value || '00:00').split(':').map(Number);
  const total = h * 60 + m;
  const snapped = dir === 1 ? Math.ceil((total + 1) / stepMin) * stepMin : Math.floor((total - 1) / stepMin) * stepMin;
  let t = snapped % (24 * 60);
  if (t < 0) t += 24 * 60;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export default function TimeStepper({
  value,
  onChange,
  stepMin = 15,
}: {
  value: string;
  onChange: (v: string) => void;
  stepMin?: number;
}) {
  // Mirror the prop so several arrow clicks in one tick chain off each other
  // instead of all computing from the same stale `value` (the parent's state
  // hasn't re-rendered yet between rapid clicks).
  const latest = useRef(value);
  latest.current = value;
  function step(dir: 1 | -1) {
    const v = latest.current;
    const onGrid = v ? Number(v.split(':')[1]) % stepMin === 0 : true;
    const next = onGrid ? addMinutes(v, dir * stepMin) : snap(v, stepMin, dir);
    latest.current = next;
    onChange(next);
  }
  return (
    <div className="time-stepper">
      <input
        type="time"
        step={stepMin * 60}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="time-stepper-btns">
        <button type="button" aria-label="Later" tabIndex={-1} onClick={() => step(1)}>
          <i className="ti ti-chevron-up" />
        </button>
        <button type="button" aria-label="Earlier" tabIndex={-1} onClick={() => step(-1)}>
          <i className="ti ti-chevron-down" />
        </button>
      </div>
    </div>
  );
}
