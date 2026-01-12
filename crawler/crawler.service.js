const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { ApiError, NotFoundError, BadRequestError } = require('../utils/ApiError');
const crypto = require('crypto');

const CategoryRepository = require('../repositories/category.repository');
const StoryRepository = require('../repositories/story.repository');
const ChapterRepository = require('../repositories/chapter.repository');
const ChapterImageRepository = require('../repositories/chapter_image.repository');
// Note: We still access models for some transactional or specific create logic if Repo is generic.
// But we should use Repo methods where available.
// For 'create', BaseRepo has it.
// For 'update', BaseRepo has it (by id). 

const OTRUYEN_API = 'https://otruyenapi.com/v1/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function safeSlug(s = '') {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
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
    let cat = await CategoryRepository.findByName(name);
    if (!cat) {
        cat = await CategoryRepository.create({ name });
    }
    ids.push(cat.id);
  }
  return ids;
}

async function attachStoryCategories(storyId, categoryIds) {
  for (const cid of categoryIds) {
    await StoryRepository.addCategory(storyId, cid);
  }
}

async function ensureStoryFromDetail(storyDetail, slug) {
  const categoryNames = storyDetail.item.category?.map((c) => c.name) || [];
  const categoryIds = await findOrCreateCategories(categoryNames);

  const author = Array.isArray(storyDetail.item.author)
    ? storyDetail.item.author.join(', ')
    : (storyDetail.item.author || '');

  let story = await StoryRepository.findByName(storyDetail.item.name);
  if (!story) {
    story = await StoryRepository.create({
      name: storyDetail.item.name,
      author,
      description: storyDetail.item.content || null,
      status: storyDetail.item.status || 'ONGOING',
      thumbnail: null
    });
  }

  await attachStoryCategories(story.id, categoryIds);

  const thumb = storyDetail.seoOnPage?.seoSchema?.image;
  if (thumb && !story.thumbnail) {
    try {
      const ext = path.extname(thumb).split('?')[0] || '.jpg';
      const baseSlug = safeSlug(slug);
      const rand = crypto.randomBytes(4).toString('hex');
      const fileName = `${baseSlug}-${rand}${ext}`;

      const rel = path.join('uploads', 'thumbnails', fileName);
      await downloadImageTo(thumb, path.join(process.cwd(), rel));

      await StoryRepository.update(story.id, { thumbnail: `/${rel.replace(/\\+/g, '/')}` });
    } catch (e) {
      console.warn(`Thumbnail error [${story.id}]:`, e?.message || e);
    }
  }

  return story;
}

async function crawlChapterImages(chapterApiUrl, chapterId) {
  const res = await axios.get(chapterApiUrl);
  const data = res.data?.data;
  if (!data?.item?.chapter_image) return 0;

  const domain = String(data.domain_cdn || '').replace(/\/$/, '');
  const chapterPath = String(data.item.chapter_path || '').replace(/^\/|\/$/g, '');
  const list = data.item.chapter_image || [];

  const lastSort = await ChapterImageRepository.getMaxSortOrder(chapterId);
  let base = Number.isFinite(lastSort) ? Number(lastSort) + 1 : 0;

  let created = 0;
  for (let i = 0; i < list.length; i++) {
    const img = list[i];
    const fullUrl = `${domain}/${chapterPath}/${img.image_file}`;

    const exists = await ChapterImageRepository.findByPath(chapterId, fullUrl);

    if (!exists) {
      await ChapterImageRepository.create({
        chapter_id: chapterId,
        img_path: fullUrl,
        img_type: 'EXTERNAL',
        sort_order: base,
      });
      base += 1;
      created += 1;
    }
  }
  return created;
}

async function crawlSingleChapter(slug, chapterNumber) {
  const raw = String(chapterNumber ?? '').trim();
  if (!slug?.trim()) throw new BadRequestError('Thiếu slug');
  if (!raw) throw new BadRequestError('Thiếu chapterNumber');

  const targetNum = parseFloat(raw);
  if (!Number.isFinite(targetNum)) {
    throw new BadRequestError('chapterNumber không hợp lệ (phải là số, ví dụ 1, 12, 12.5)');
  }

  let storyDetail;
  try {
    const response = await axios.get(`${OTRUYEN_API}/truyen-tranh/${slug}`);
    storyDetail = response.data?.data;
  } catch (err) {
    if (axios.isAxiosError(err)) throw new ApiError(502, `OTruyen API lỗi: ${err.message}`);
    throw err;
  }
  if (!storyDetail?.item) throw new NotFoundError(`Không tìm thấy truyện với slug: ${slug}`);

  let found = null;
  for (const server of storyDetail.item.chapters || []) {
    for (const ch of server.server_data || []) {
      const chNumber = parseFloat(ch.chapter_name);
      if (Number.isFinite(chNumber) && chNumber === targetNum) {
        found = ch;
        break;
      }
    }
    if (found) break;
  }
  if (!found) {
    throw new NotFoundError(`Không tìm thấy chapter ${targetNum} cho slug: ${slug}`);
  }
  if (!found.chapter_api_data) {
    throw new NotFoundError(`Chapter ${targetNum} không có dữ liệu ảnh (chapter_api_data rỗng)`);
  }

  const story = await ensureStoryFromDetail(storyDetail, slug);

  let chapter = await ChapterRepository.findByStoryAndNumber(story.id, targetNum);
  if (!chapter) {
    chapter = await ChapterRepository.create({
      story_id: story.id,
      chapter_number: targetNum,
      title: found.chapter_title || ''
    });
  }

  let images_added = 0;
  try {
    images_added = await crawlChapterImages(found.chapter_api_data, chapter.id);
  } catch (e) {
    console.warn(`Chapter images error [chapter=${chapter.id}]:`, e?.message || e);
  }

  return {
    story_id: story.id,
    chapter_id: chapter.id,
    chapter_number: chapter.chapter_number,
    images_added
  };
}

async function crawlStoryDetail(slug) {
  if (!slug?.trim()) throw new BadRequestError('Thiếu slug');

  let storyDetail;
  try {
    const response = await axios.get(`${OTRUYEN_API}/truyen-tranh/${slug}`);
    storyDetail = response.data?.data;
  } catch (err) {
    if (axios.isAxiosError(err)) throw new ApiError(502, `OTruyen API lỗi: ${err.message}`);
    throw err;
  }
  if (!storyDetail?.item) throw new NotFoundError(`Không tìm thấy truyện với slug: ${slug}`);

  const story = await ensureStoryFromDetail(storyDetail, slug);

  for (const server of storyDetail.item.chapters || []) {
    for (const ch of server.server_data || []) {
      const chNumber = parseFloat(ch.chapter_name);
      if (!Number.isFinite(chNumber)) continue;

      let chapter = await ChapterRepository.findByStoryAndNumber(story.id, chNumber);
      if (!chapter) {
        chapter = await ChapterRepository.create({
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

module.exports = {
  crawlStoryDetail,
  crawlAllStory,
  crawlSingleChapter,
};
