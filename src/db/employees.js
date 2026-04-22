// CRUD for gemini_live.employee_instances
const { execute, queryOne, queryAll, uid } = require('./index');

async function createEmployeeInstance({ employeeName, instanceName, phone, status }) {
  const existing = await queryOne('SELECT * FROM employee_instances WHERE employee_name = $1', [employeeName]);
  const id = existing?.id || uid();
  await execute(
    `INSERT INTO employee_instances (id, employee_name, instance_name, phone, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET employee_name = $2, instance_name = $3, phone = $4, status = $5, updated_at = now()`,
    [id, employeeName, instanceName, phone || null, status || 'pending']
  );
  return queryOne('SELECT * FROM employee_instances WHERE id = $1', [id]);
}

async function listEmployeeInstances() {
  return queryAll('SELECT * FROM employee_instances ORDER BY employee_name');
}

async function getEmployeeInstance(id) {
  return queryOne('SELECT * FROM employee_instances WHERE id = $1', [id]);
}

async function getEmployeeByName(name) {
  return queryOne('SELECT * FROM employee_instances WHERE employee_name = $1', [name]);
}

async function updateEmployeeInstance(id, { employeeName, instanceName, phone, status }) {
  await execute(
    `UPDATE employee_instances SET
      employee_name = COALESCE($1, employee_name), instance_name = COALESCE($2, instance_name),
      phone = COALESCE($3, phone), status = COALESCE($4, status), updated_at = now()
     WHERE id = $5`,
    [employeeName || null, instanceName || null, phone || null, status || null, id]
  );
  return queryOne('SELECT * FROM employee_instances WHERE id = $1', [id]);
}

async function deleteEmployeeInstance(id) {
  await execute('DELETE FROM employee_instances WHERE id = $1', [id]);
}

async function getUniqueEmployeeNames() {
  const rows = await queryAll(`
    SELECT DISTINCT employee_name FROM contacts
    WHERE employee_name IS NOT NULL AND employee_name != ''
    ORDER BY employee_name
  `);
  return rows.map(r => r.employee_name);
}

module.exports = {
  createEmployeeInstance, listEmployeeInstances, getEmployeeInstance, getEmployeeByName,
  updateEmployeeInstance, deleteEmployeeInstance, getUniqueEmployeeNames,
};
