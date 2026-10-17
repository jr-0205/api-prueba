const express = require('express');

const { revokeSession } = require('../lib/sessions');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    await revokeSession(req.db, req.sessionId);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
