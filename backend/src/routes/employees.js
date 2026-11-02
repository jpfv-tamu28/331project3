import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { asyncRoute, HttpError, PIN_PATTERN, requireId, requireText } from '../http.js';

const router = Router();

// Only Managers can open the Manager view; any other role (Cashier, Barista, Shift Lead...) gets the Cashier view.
const MAX_ROLE_LENGTH = 50;

// pin is optional on edit: blank keeps the current PIN.
function parseEmployee(body = {}, { pinRequired }) {
  const role = requireText(body.role, 'Role');
  if (role.length > MAX_ROLE_LENGTH) {
    throw new HttpError(400, `Role must be at most ${MAX_ROLE_LENGTH} characters.`);
  }
  const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
  if ((pinRequired || pin !== '') && !PIN_PATTERN.test(pin)) {
    throw new HttpError(400, 'PIN must be 6 digits.');
  }
  return {
    name: requireText(body.name, 'Name'),
    role,
    isActive: body.isActive !== false,
    pin: pin === '' ? null : pin,
  };
}

// pin is UNIQUE, so a duplicate shows up as a 23505 error; report it in words.
function rethrowDuplicatePin(err) {
  if (err.code === '23505') {
    throw new HttpError(409, 'Another employee already uses that PIN.');
  }
  throw err;
}

// GET /api/employees (PINs are never sent to the browser)
router.get('/', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT employee_id AS id, name, role, is_active AS "isActive", pin IS NOT NULL AS "hasPin"
     FROM employees ORDER BY employee_id`,
  );
  res.json(rows);
}));

// POST /api/employees { name, role, pin, isActive }
router.post('/', asyncRoute(async (req, res) => {
  const emp = parseEmployee(req.body, { pinRequired: true });
  // employee_id is not SERIAL, so new IDs are MAX + 1 under a table lock.
  const id = await withTransaction(async (client) => {
    await client.query('LOCK TABLE employees IN SHARE ROW EXCLUSIVE MODE');
    const { rows } = await client.query(
      `INSERT INTO employees (employee_id, name, role, is_active, pin)
       VALUES ((SELECT COALESCE(MAX(employee_id), 0) + 1 FROM employees), $1, $2, $3, $4)
       RETURNING employee_id AS id`,
      [emp.name, emp.role, emp.isActive, emp.pin],
    );
    return rows[0].id;
  }).catch(rethrowDuplicatePin);
  res.status(201).json({ id });
}));

// PUT /api/employees/:id { name, role, pin?, isActive }
router.put('/:id', asyncRoute(async (req, res) => {
  const id = requireId(req.params.id);
  const emp = parseEmployee(req.body, { pinRequired: false });
  const { rowCount } = await pool.query(
    `UPDATE employees SET name = $1, role = $2, is_active = $3, pin = COALESCE($4, pin)
     WHERE employee_id = $5`,
    [emp.name, emp.role, emp.isActive, emp.pin, id],
  ).catch(rethrowDuplicatePin);
  if (rowCount === 0) throw new HttpError(404, `Employee #${id} was not found.`);
  res.json({ id });
}));

export default router;
