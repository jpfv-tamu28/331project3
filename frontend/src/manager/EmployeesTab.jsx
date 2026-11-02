import { useState } from 'react';
import { Api, errorMessage } from '../api';
import { DenseList, Modal, StateMessage, useResource, useToast } from '../components/ui';

const PIN_LENGTH = 6;

const ROLES = ['Cashier', 'Manager'];

const FILTERS = [
  { label: 'All', test: () => true },
  { label: 'Active', test: (e) => e.isActive },
  { label: 'Inactive', test: (e) => !e.isActive },
];

const describe = (e) => ({
  title: e.name,
  subtitle: `Employee #${e.id}${e.hasPin ? '' : ' · no PIN, cannot log in'}`,
  value: e.role,
  badge: e.isActive ? null : { text: 'Inactive' },
});

export default function EmployeesTab({ refreshKey }) {
  const employees = useResource(() => Api.employees(), [refreshKey]);
  const [editing, setEditing] = useState(null);

  if (!employees.data) {
    return <StateMessage loading={employees.loading} error={employees.error} onRetry={employees.reload} />;
  }
  return (
    <>
      <DenseList
        items={employees.data}
        searchLabel="Search employees"
        filters={FILTERS}
        groupOf={(e) => `${e.role}s`}
        pinnedGroups={['Managers', 'Cashiers']}
        describe={describe}
        onOpen={setEditing}
        noun="employee"
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing({})}>Add Employee</button>}
      />
      {editing && (
        <EmployeeDialog
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            employees.reload();
          }}
        />
      )}
    </>
  );
}

function EmployeeDialog({ employee, onClose, onSaved }) {
  const toast = useToast();
  const editingId = employee.id ?? null;
  const [name, setName] = useState(employee.name ?? '');
  const [role, setRole] = useState(employee.role ?? ROLES[0]);
  const [pin, setPin] = useState('');
  const [isActive, setActive] = useState(employee.isActive ?? true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.warning('Missing name', 'Name is required.');
      return;
    }
    // Blank keeps the current PIN when editing.
    if (!(editingId && pin === '') && !new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
      toast.warning('Invalid PIN', `PIN must be ${PIN_LENGTH} digits.`);
      return;
    }
    setBusy(true);
    try {
      await Api.saveEmployee(editingId, { name: name.trim(), role, pin, isActive });
      toast.success(editingId ? 'Employee updated' : 'Employee added', name.trim());
      onSaved();
    } catch (err) {
      toast.error('Error saving employee', errorMessage(err));
      setBusy(false);
    }
  };

  // Roles from older data (Barista, Shift Lead…) stay selectable for that employee.
  const roleOptions = ROLES.includes(role) ? ROLES : [...ROLES, role];
  return (
    <Modal title={editingId ? 'Edit Employee' : 'Add Employee'} submitLabel="Save" onSubmit={save} onClose={onClose} busy={busy}>
      <div className="form-grid">
        <label htmlFor="em-name">Name</label>
        <input id="em-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="em-role">Role</label>
        <select id="em-role" className="field" value={role} onChange={(e) => setRole(e.target.value)}>
          {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <label htmlFor="em-pin">{editingId ? 'New PIN' : 'PIN'}</label>
        <div>
          <input
            id="em-pin"
            className="field"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={PIN_LENGTH}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
            aria-describedby={editingId ? 'em-pin-hint' : undefined}
          />
          {editingId && <p id="em-pin-hint" className="field-hint">Leave blank to keep the current PIN.</p>}
        </div>
        <span />
        <label className="checkbox">
          <input type="checkbox" checked={isActive} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
      </div>
    </Modal>
  );
}
