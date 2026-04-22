// src/routes/employees.js
// GET  /api/employee-instances/auto-detect  — detect unmapped employees
// GET  /api/employee-instances              — list all instances
// POST /api/employee-instances              — create instance
// PATCH/DELETE /api/employee-instances/:id  — update/delete
const { Router } = require('express');

module.exports = (deps) => {
  const { db } = deps;
  const router = Router();

  // auto-detect must come before /:id to avoid being shadowed
  router.get('/api/employee-instances/auto-detect', async (req, res) => {
    try {
      const employeeNames = await db.getUniqueEmployeeNames();
      const mappings = await db.listEmployeeInstances();
      const result = employeeNames.map(name => {
        const mapping = mappings.find(m => m.employee_name.toLowerCase() === name.toLowerCase());
        return {
          employee_name: name,
          mapped: !!mapping,
          id: mapping?.id || null,
          instance_name: mapping?.instance_name || null,
          status: mapping?.status || null,
        };
      });
      // Also include mapped employees not in campaigns
      for (const m of mappings) {
        if (!result.find(r => r.employee_name.toLowerCase() === m.employee_name.toLowerCase())) {
          result.push({ employee_name: m.employee_name, mapped: true, id: m.id, instance_name: m.instance_name, status: m.status });
        }
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/employee-instances', async (req, res) => {
    res.json(await db.listEmployeeInstances());
  });

  router.post('/api/employee-instances', async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.employee_name || !body.instance_name) {
        return res.status(400).json({ error: 'employee_name and instance_name required' });
      }
      const inst = await db.createEmployeeInstance({
        employeeName: body.employee_name,
        instanceName: body.instance_name,
        phone: body.phone,
        status: body.status || 'pending',
      });
      res.status(201).json(inst);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch('/api/employee-instances/:id', async (req, res) => {
    try {
      const body = req.body || {};
      const inst = await db.updateEmployeeInstance(req.params.id, {
        employeeName: body.employee_name,
        instanceName: body.instance_name,
        phone: body.phone,
        status: body.status,
      });
      if (!inst) return res.status(404).json({ error: 'Not found' });
      res.json(inst);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/api/employee-instances/:id', async (req, res) => {
    await db.deleteEmployeeInstance(req.params.id);
    res.json({ ok: true });
  });

  return router;
};
