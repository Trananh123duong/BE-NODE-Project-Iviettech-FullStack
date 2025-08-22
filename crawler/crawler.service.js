// services/crawler.service.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const models = require('../models');
const { ApiError, NotFoundError, BadRequestError } = require('../utils/ApiError');
const crypto = require('crypto');

const OTRUYEN_API = 'https://otruyenapi.com/v1/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function safeSlug(s = '') {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\-]+/g, '-') // chỉ giữ a-z, 0-9, dấu -
    .replace(/-+/g, '-')           // gộp nhiều dấu -
    .replace(/^-+|-+$/g, '')       // bỏ - ở đầu/cuối
    .slice(0, 80);                 // tránh quá dài
}

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

async function findOrCreateCategories(names) {
  const ids = [];
  for (const name of names || []) {
    let cat = await models.categories.findOne({ where: { name }, attributes: ['id'] });
    if (!cat) cat = await models.categories.create({ name });
    ids.push(cat.id);
  }
  return ids;
}

async function attachStoryCategories(storyId, categoryIds) {
  if (!models.story_categories) return;
  for (const cid of categoryIds) {
    const exists = await models.story_categories.findOne({
      where: { story_id: storyId, category_id: cid },
      attributes: ['story_id']
    });
    if (!exists) {
      await models.story_categories.create({ story_id: storyId, category_id: cid });
    }
  }
}

async function crawlChapterImages(chapterApiUrl, chapterId) {
  const res = await axios.get(chapterApiUrl);
  const data = res.data?.data;
  if (!data?.item?.chapter_image) return;

  const domain = String(data.domain_cdn || '').replace(/\/$/, '');
  const chapterPath = String(data.item.chapter_path || '').replace(/^\/|\/$/g, '');
  const list = data.item.chapter_image || [];

  for (const img of list) {
    const fullUrl = `${domain}/${chapterPath}/${img.image_file}`;

    // chống trùng tay
    const exists = await models.chapter_images.findOne({
      where: { chapter_id: chapterId, img_path: fullUrl },
      attributes: ['id']
    });
    if (!exists) {
      await models.chapter_images.create({
        chapter_id: chapterId,
        img_path: fullUrl,
        img_type: 'EXTERNAL'
      });
    }
  }
}

async function crawlStoryDetail(slug) {
  if (!slug?.trim()) throw new BadRequestError('Thiếu slug');

  // 1) Lấy detail từ API
  let storyDetail;
  try {
    const response = await axios.get(`${OTRUYEN_API}/truyen-tranh/${slug}`);
    storyDetail = response.data?.data;
  } catch (err) {
    if (axios.isAxiosError(err)) throw new ApiError(502, `OTruyen API lỗi: ${err.message}`);
    throw err;
  }
  if (!storyDetail?.item) throw new NotFoundError(`Không tìm thấy truyện với slug: ${slug}`);

  // 2) Categories
  const categoryNames = storyDetail.item.category?.map((c) => c.name) || [];
  const categoryIds = await findOrCreateCategories(categoryNames);

  // 3) Story
  const author = Array.isArray(storyDetail.item.author)
    ? storyDetail.item.author.join(', ')
    : (storyDetail.item.author || '');

  let story = await models.stories.findOne({
    where: { name: storyDetail.item.name }
  });
  if (!story) {
    story = await models.stories.create({
      name: storyDetail.item.name,
      author,
      description: storyDetail.item.content || null,
      status: storyDetail.item.status || 'ONGOING',
      thumbnail: null
    });
  }

  // 4) Story-Categories
  await attachStoryCategories(story.id, categoryIds);

  // 5) Thumbnail (không ảnh hưởng data core nếu lỗi)
  const thumb = storyDetail.seoOnPage?.seoSchema?.image;
  if (thumb) {
    try {
      const ext = path.extname(thumb).split('?')[0] || '.jpg';
      const baseSlug = safeSlug(slug);
      const rand = crypto.randomBytes(4).toString('hex'); // ví dụ "a1b2c3d4"
      const fileName = `${baseSlug}-${rand}${ext}`;

      const rel = path.join('uploads', 'thumbnails', fileName);
      await downloadImageTo(thumb, path.join(process.cwd(), rel));

      await models.stories.update(
        { thumbnail: `/${rel.replace(/\\+/g, '/')}` },
        { where: { id: story.id } }
      );
    } catch (e) {
      console.warn(`Thumbnail error [${story.id}]:`, e?.message || e);
    }
  }

  // 6) Chapters + images (mỗi chapter tự xử; lỗi chapter nào bỏ chapter đó)
  for (const server of storyDetail.item.chapters || []) {
    for (const ch of server.server_data || []) {
      const chNumber = parseFloat(ch.chapter_name);
      if (!Number.isFinite(chNumber)) continue;

      let chapter = await models.chapters.findOne({
        where: { story_id: story.id, chapter_number: chNumber },
        attributes: ['id']
      });
      if (!chapter) {
        chapter = await models.chapters.create({
          story_id: story.id,
          chapter_number: chNumber,
          title: ch.chapter_title || ''
        });
      }

      if (ch.chapter_api_data) {
        try {
          await crawlChapterImages(ch.chapter_api_data, chapter.id);
          await sleep(200);
        } catch (e) {
          console.warn(`Chapter images error [chapter=${chapter.id}]:`, e?.message || e);
        }
      }
    }
  }

  return story.id;
}

async function crawlAllStory(pages = 5) {
  const p = Number(pages);
  if (!Number.isFinite(p) || p < 1) throw new BadRequestError('pages phải là số >= 1');

  const processed = [];
  for (let page = 1; page <= p; page++) {
    let items = [];
    try {
      const res = await axios.get(`${OTRUYEN_API}/danh-sach/truyen-moi?page=${page}`);
      items = res.data?.data?.items || [];
    } catch (e) {
      throw new ApiError(502, `OTruyen API lỗi (page ${page}): ${e.message || e}`);
    }

    for (const it of items) {
      try {
        const id = await crawlStoryDetail(it.slug);
        processed.push({ slug: it.slug, story_id: id });
        await sleep(400);
      } catch (e) {
        processed.push({ slug: it.slug, error: e.message || String(e) });
      }
    }
  }
  return { pages: p, total: processed.length, processed };
}

module.exports = { crawlStoryDetail, crawlAllStory };
