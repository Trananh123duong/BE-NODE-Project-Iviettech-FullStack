// services/crawler.service.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sequelize = require('../config/db');
const models = require('../models');
const { ApiError, NotFoundError, BadRequestError } = require('../utils/ApiError');

const OTRUYEN_API = 'https://otruyenapi.com/v1/api';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function downloadImageTo(fileUrl, outPath) {
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const res = await axios.get(fileUrl, {
    responseType: 'stream',
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://otruyenapi.com' }
  });
  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outPath);
    res.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function findOrCreateCategories(names, t) {
  const ids = [];
  for (const name of names || []) {
    const [cat] = await models.categories.findOrCreate({
      where: { name },
      defaults: { name },
      transaction: t
    });
    ids.push(cat.id);
  }
  return ids;
}

async function attachStoryCategories(storyId, categoryIds, t) {
  if (!models.story_categories) return;
  for (const cid of categoryIds) {
    await models.story_categories.findOrCreate({
      where: { story_id: storyId, category_id: cid },
      defaults: { story_id: storyId, category_id: cid },
      transaction: t
    });
  }
}

async function crawlChapterImages(chapterApiUrl, chapterId, t) {
  const res = await axios.get(chapterApiUrl);
  const data = res.data?.data;
  if (!data?.item?.chapter_image) return;

  const domain = String(data.domain_cdn || '').replace(/\/$/, '');
  const chapterPath = String(data.item.chapter_path || '').replace(/^\/|\/$/g, '');
  for (const img of data.item.chapter_image || []) {
    const fullUrl = `${domain}/${chapterPath}/${img.image_file}`;
    await models.chapter_images.findOrCreate({
      where: { chapter_id: chapterId, img_path: fullUrl },
      defaults: { chapter_id: chapterId, img_path: fullUrl, img_type: 'EXTERNAL' },
      transaction: t
    });
  }
}

/** Ném NotFoundError nếu slug không tồn tại */
async function crawlStoryDetail(slug) {
  if (!slug?.trim()) throw new BadRequestError('Thiếu slug');

  const url = `${OTRUYEN_API}/truyen-tranh/${slug}`;
  const t = await sequelize.transaction();
  try {
    const response = await axios.get(url);
    const storyDetail = response.data?.data;
    if (!storyDetail?.item) {
      throw new NotFoundError(`Không tìm thấy truyện với slug: ${slug}`);
    }

    const categoryNames = storyDetail.item.category?.map(c => c.name) || [];
    const categoryIds = await findOrCreateCategories(categoryNames, t);

    const author = Array.isArray(storyDetail.item.author)
      ? storyDetail.item.author.join(', ')
      : (storyDetail.item.author || '');

    const [story] = await models.stories.findOrCreate({
      where: { name: storyDetail.item.name },
      defaults: {
        name: storyDetail.item.name,
        author,
        description: storyDetail.item.content || null,
        status: storyDetail.item.status || 'ONGOING',
        thumbnail: null
      },
      transaction: t
    });

    await attachStoryCategories(story.id, categoryIds, t);

    const thumb = storyDetail.seoOnPage?.seoSchema?.image;
    if (thumb) {
      const ext = path.extname(thumb).split('?')[0] || '.jpg';
      const rel = path.join('uploads', 'thumbnails', `${story.id}${ext}`);
      await downloadImageTo(thumb, path.join(process.cwd(), rel));
      await story.update({ thumbnail: `/${rel.replace(/\\+/g, '/')}` }, { transaction: t });
    }

    for (const server of storyDetail.item.chapters || []) {
      for (const ch of server.server_data || []) {
        const chNumber = parseFloat(ch.chapter_name);
        if (!Number.isFinite(chNumber)) continue;

        const [chapter] = await models.chapters.findOrCreate({
          where: { story_id: story.id, chapter_number: chNumber },
          defaults: { story_id: story.id, chapter_number: chNumber, title: ch.chapter_title || '' },
          transaction: t
        });

        if (ch.chapter_api_data) {
          await crawlChapterImages(ch.chapter_api_data, chapter.id, t);
          await sleep(300);
        }
      }
    }

    await t.commit();
    return story.id;
  } catch (err) {
    await t.rollback();
    // Map lỗi axios sang ApiError 502 cho đẹp (tùy bạn đã định nghĩa)
    if (axios.isAxiosError(err)) {
      throw new ApiError(502, `Upstream OTruyen API lỗi: ${err.message}`);
    }
    throw err;
  }
}

/** Trả về summary, ném ApiError nếu trang không hợp lệ */
async function crawlAllStory(pages = 5) {
  const p = Number(pages);
  if (!Number.isFinite(p) || p < 1) throw new BadRequestError('pages phải là số >= 1');

  const processed = [];
  for (let page = 1; page <= p; page++) {
    const res = await axios.get(`${OTRUYEN_API}/danh-sach/truyen-moi?page=${page}`);
    const items = res.data?.data?.items || [];
    
    for (const it of items) {
      try {
        const id = await crawlStoryDetail(it.slug);
        processed.push({ slug: it.slug, story_id: id });
        await sleep(500);
      } catch (e) {
        // Không nuốt lỗi toàn cục; ghi nhận per-item
        processed.push({ slug: it.slug, error: e.message || String(e) });
      }
    }
  }
  return { pages: p, total: processed.length, processed };
}

module.exports = { crawlStoryDetail, crawlAllStory };
