import { useState } from 'react';
import { useStore } from '../lib/store';
import Modal, { field, primaryBtn } from './Modal';
import type { PersonRec } from '../lib/types';

export default function AddStaff({
  onClose,
  onAdded,
  canMakeAdmin = false,
}: {
  onClose: () => void;
  onAdded?: (p: PersonRec) => void;
  canMakeAdmin?: boolean;
}) {
  const { addPerson } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [admin, setAdmin] = useState(false);

  function submit() {
    if (!name.trim()) return;
    const makeAdmin = admin && canMakeAdmin;
    const p = addPerson({
      name: name.trim(),
      email: email.trim() || `${name.trim().toLowerCase().replace(/\s+/g, '.')}@demo.wcsmiami.org`,
      event: makeAdmin ? 'Creator' : 'Viewer',
      rooms: makeAdmin ? 'Editor' : 'Viewer',
      resources: makeAdmin ? 'Editor' : 'Viewer',
      people: makeAdmin ? 'Editor' : 'Viewer',
      resolves_conflicts: makeAdmin,
      site_admin: makeAdmin,
      active: true,
    });
    onAdded?.(p);
    onClose();
  }

  return (
    <Modal title="Add staff member" onClose={onClose}>
      <label className="flabel">Full name</label>
      <input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" autoFocus />
      <label className="flabel">Email</label>
      <input
        style={field}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="optional — auto-generated if blank"
      />
      {canMakeAdmin && (
        <label className="flabel" style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
          <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
          Administrator (can approve & manage people)
        </label>
      )}
      <button style={{ ...primaryBtn, marginTop: 18 }} onClick={submit}>
        Add staff member
      </button>
    </Modal>
  );
}
