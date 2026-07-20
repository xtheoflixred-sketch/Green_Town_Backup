const express = require('express');
const router = express.Router();
const { getMockAccounts } = require('../ts/server/api/mock-login');

router.get('/accounts', getMockAccounts);

module.exports = router;
