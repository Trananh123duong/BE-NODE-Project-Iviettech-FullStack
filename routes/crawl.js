// routes/crawl.js
const express = require('express');
const { crawlBySlug, crawlPages } = require('../controllers/crawl.controller');
const router = express.Router();

router.get('/', crawlPages);          // ?pages=2
router.get('/:slug', crawlBySlug);   // /crawl/one-piece

// Crawl 1 chapter
//   GET /crawl/chapter/:slug/:chapter
//   ví dụ: /crawl/chapter/one-piece/12.5  hoặc /crawl/chapter/one-piece/12
router.get('/chapter/:slug/:chapter', crawlOneChapter);

module.exports = router;
