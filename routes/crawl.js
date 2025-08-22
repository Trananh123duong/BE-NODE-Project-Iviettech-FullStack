// routes/crawl.js
const express = require('express');
const { crawlBySlug, crawlPages } = require('../controllers/crawl.controller');
const router = express.Router();

router.get('/', crawlPages);          // ?pages=2
router.get('/:slug', crawlBySlug);   // /crawl/one-piece

module.exports = router;
