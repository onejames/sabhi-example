const express = require('express');
const app = express();
app.use(express.json());
// Mount your routes here
app.use('/billing', require('./routes/billing.routes'));
module.exports = app;