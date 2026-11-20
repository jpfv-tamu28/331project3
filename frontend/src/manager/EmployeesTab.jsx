import { useMemo, useState } from 'react';
import { Api, errorMessage } from '../api';
import { Modal } from '../components/Modal';
import { StateMessage } from '../components/StateMessage';
import { StatusBadge, TableView } from '../components/TableView';
import { useResource } from '../components/useResource';
import { useToast } from '../components/ToastProvider';

const PIN_LENGTH = 6;

const ROLES = ['Cashier', 'Manager'];

const FILTERS = [
  { label: 'All', test: () => true },
  { label: 'Active', test: (e) => e.isActive },
  { label: 'Inactive', test: (e) => !e.isActive },
];

const COLUMNS = [
  { key: 'id', label: 'ID', type: 'id' },
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  {
    key: 'pinStatus',
    label: 'PIN',
    render: (e) => (e.hasPin ? 'Set' : <StatusBadge text="Not set, cannot log in" alert />),
  },
  { key: 'status', label: 'Status', render: (e) => (e.isActive ? 'Active' : <StatusBadge text="Inactive" />) },
];

const searchText = (e) => `${e.name} ${e.role} #${e.id}`;
// Managers first, then by name, until a column header is clicked.
const ROLE_ORDER = { Manager: 0, Cashier: 1 };

export default function EmployeesTab({ refreshKey }) {
  const employees = useResource(() => Api.employees(), [refreshKey]);
  const [editing, setEditing] = useState(null);

  const rows = useMemo(() => (employees.data ?? [])
    .map((e) => ({ ...e, pinStatus: e.hasPin ? 'Set' : 'Not set', status: e.isActive ? 'Active' : 'Inactive' }))
    .sort((a, b) => ((ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9)) || a.name.localeCompare(b.name)), [employees.data]);

  if (!employees.data) {
    return <StateMessage loading={employees.loading} error={employees.error} onRetry={employees.reload} />;
  }
  return (
    <>
      <TableView
        rows={rows}
        columns={COLUMNS}
        rowKey={(e) => e.id}
        caption="Employees"
        searchLabel="Search employees"
        searchText={searchText}
        filters={FILTERS}
        onSelect={setEditing}
        rowClassName={(e) => (e.isActive ? '' : 'row-muted')}
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
