#!/usr/bin/env node
'use strict';

require('dotenv').config();
const { runPipeline } = require('./pipeline');

runPipeline().then(() => {
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
