require('dotenv').config();
require('../config/db'); // optional: để log “connected”
const { crawlAllStory } = require('../crawler/crawler.service');

crawlAllStory()
  .then(() => { console.log('Done'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
