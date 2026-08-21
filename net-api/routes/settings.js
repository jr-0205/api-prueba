const express = require('express');

const { normalizeHttpUrl } = require('../lib/validation');
const { publicSettings, VISUAL_SETTINGS } = require('../lib/visual-settings');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function readRows(req, res, next, send) {
  req.db.all('SELECT clave, valor, actualizado_en FROM configuracion_visual', [], (error, rows) => {
    if (error) return next(error);
    return send(rows);
  });
}

function settingInput(key, value) {
  const definition = VISUAL_SETTINGS[key];
  if (!definition) return { valid: false, status: 404, error: 'La configuración visual no existe.' };
  const url = normalizeHttpUrl(value, 1500, 'El enlace');
  if (!url.valid || !url.value) return { valid: false, status: 400, error: url.error || 'El enlace es obligatorio.' };
  return { valid: true, value: url.value, definition };
}

router.get('/', (req, res, next) => readRows(req, res, next, (rows) => res.json(publicSettings(rows))));

router.get('/admin', requireAuth, requireRole('admin'), (req, res, next) => readRows(req, res, next, (rows) => {
  const stored = new Map(rows.map((row) => [row.clave, row]));
  return res.json(Object.entries(VISUAL_SETTINGS).map(([key, definition]) => ({
    key,
    label: definition.label,
    description: definition.description,
    value: stored.get(key)?.valor || definition.defaultValue,
    defaultValue: definition.defaultValue,
    customized: Boolean(stored.get(key) && stored.get(key).valor !== definition.defaultValue),
    updatedAt: stored.get(key)?.actualizado_en || null,
  })));
}));

function saveSetting(req, res, next, key) {
  const input = settingInput(key, req.body.value);
  if (!input.valid) return res.status(input.status).json({ error: input.error });
  req.db.run(
    `INSERT INTO configuracion_visual (clave, valor, actualizado_en)
     VALUES (?, ?, DATETIME('now'))
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = excluded.actualizado_en`,
    [key, input.value],
    (error) => {
      if (error) return next(error);
      return res.json({ key, value: input.value, customized: input.value !== input.definition.defaultValue });
    },
  );
}

router.post('/', requireAuth, requireRole('admin'), (req, res, next) => {
  const key = String(req.body.key || '').trim();
  return saveSetting(req, res, next, key);
});

router.put('/:key', requireAuth, requireRole('admin'), (req, res, next) => saveSetting(req, res, next, req.params.key));

router.delete('/:key', requireAuth, requireRole('admin'), (req, res, next) => {
  const definition = VISUAL_SETTINGS[req.params.key];
  if (!definition) return res.status(404).json({ error: 'La configuración visual no existe.' });
  req.db.run('DELETE FROM configuracion_visual WHERE clave = ?', [req.params.key], (error) => {
    if (error) return next(error);
    return res.json({ key: req.params.key, value: definition.defaultValue, customized: false });
  });
});

module.exports = router;
