// Visual room-setup templates. The whole point: a top-down picture removes
// the ambiguity a text field can't — a setup crew (often ESL) taps the layout
// they're told to build instead of decoding "banquet rounds, 8 per." These are
// the industry-standard "setup styles" you see in event/banquet software.

export interface SetupStyle {
  id: string;
  name: string;
  desc: string;
}

export const setupStyles: SetupStyle[] = [
  { id: 'theater', name: 'Theater / rows', desc: 'Rows of chairs facing front — assemblies, ceremonies.' },
  { id: 'banquet', name: 'Banquet rounds', desc: 'Round tables with chairs — team meals, galas.' },
  { id: 'classroom', name: 'Classroom', desc: 'Rows of tables facing front — workshops, exams.' },
  { id: 'ushape', name: 'U-shape', desc: 'Tables in a U — board meetings, discussions.' },
  { id: 'clear', name: 'Clear floor', desc: 'No furniture — dances, PE, open space.' },
  { id: 'custom', name: 'Custom — see notes', desc: 'Describe it below; the crew will confirm.' },
];

export function setupStyleName(id?: string | null): string | undefined {
  return setupStyles.find((s) => s.id === id)?.name;
}

function seatsAround(cx: number, cy: number, r: number, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

// One reusable top-down diagram. Colors come from CSS classes (App.css) so it
// themes light/dark automatically.
export function SetupDiagram({ id }: { id: string }) {
  const seat = (x: number, y: number, k: string) => <circle key={k} className="sd-seat" cx={x} cy={y} r={2.6} />;

  let body: React.ReactNode = null;

  if (id === 'theater') {
    const rows = [30, 44, 58, 72];
    const cols = [20, 33, 46, 59, 72, 85, 98];
    body = (
      <>
        <rect className="sd-front" x={14} y={8} width={92} height={7} rx={2} />
        {rows.flatMap((y) => cols.map((x) => seat(x, y, `t${x}-${y}`)))}
      </>
    );
  } else if (id === 'banquet') {
    const centers = [
      [38, 32],
      [86, 32],
      [38, 64],
      [86, 64],
    ];
    body = (
      <>
        {centers.map(([cx, cy], ti) => (
          <g key={ti}>
            <circle className="sd-tbl" cx={cx} cy={cy} r={9} />
            {seatsAround(cx, cy, 14, 6).map((p, si) => seat(p.x, p.y, `b${ti}-${si}`))}
          </g>
        ))}
      </>
    );
  } else if (id === 'classroom') {
    const rows = [36, 54, 72];
    const cols = [22, 68];
    body = (
      <>
        <rect className="sd-front" x={14} y={8} width={92} height={7} rx={2} />
        {rows.flatMap((y) =>
          cols.map((x) => (
            <g key={`${x}-${y}`}>
              <rect className="sd-tbl" x={x} y={y} width={30} height={6} rx={1.5} />
              {[6, 15, 24].map((dx) => seat(x + dx, y - 5, `c${x}-${y}-${dx}`))}
            </g>
          )),
        )}
      </>
    );
  } else if (id === 'ushape') {
    body = (
      <>
        <rect className="sd-tbl" x={28} y={22} width={64} height={7} rx={1.5} />
        <rect className="sd-tbl" x={28} y={22} width={7} height={48} rx={1.5} />
        <rect className="sd-tbl" x={85} y={22} width={7} height={48} rx={1.5} />
        {[44, 58, 70].map((x) => seat(x, 16, `ut${x}`))}
        {[36, 50, 64].map((y) => seat(22, y, `ul${y}`))}
        {[36, 50, 64].map((y) => seat(98, y, `ur${y}`))}
      </>
    );
  } else if (id === 'clear') {
    body = (
      <>
        <rect className="sd-clear" x={16} y={14} width={88} height={56} rx={7} />
        <path className="sd-arrow" d="M60 30 L60 54 M52 38 L60 30 L68 38 M52 46 L60 54 L68 46" />
      </>
    );
  } else {
    body = (
      <>
        <rect className="sd-clear" x={16} y={14} width={88} height={56} rx={7} />
        {[48, 60, 72].map((x) => seat(x, 42, `q${x}`))}
      </>
    );
  }

  return (
    <svg className="setup-diagram" viewBox="0 0 120 84" aria-hidden="true">
      {body}
    </svg>
  );
}
