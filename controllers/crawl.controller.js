const asyncHandler = require('express-async-handler');
const { crawlAllStory, crawlStoryDetail } = require('../crawler/crawler.service');
const { BadRequestError } = require('../utils/ApiError');

const crawlBySlug = asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || req.query.slug || '').trim();
  if (!slug) throw new BadRequestError('Thiếu slug');
  const id = await crawlStoryDetail(slug);
  res.json({ ok: true, story_id: id });
});

const crawlPages = asyncHandler(async (req, res) => {
  const pages = req.query.pages ? Number(req.query.pages) : 5;
  const summary = await crawlAllStory(pages);
  res.json({ ok: true, ...summary });
});

module.exports = { crawlBySlug, crawlPages };
