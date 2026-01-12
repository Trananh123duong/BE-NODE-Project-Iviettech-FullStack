const BaseRepository = require('./base.repository');
const { chapter_images: ChapterImage } = require('../models');

class ChapterImageRepository extends BaseRepository {
  constructor() {
    super(ChapterImage);
  }

  async findByPath(chapterId, imgPath) {
    return await this.model.findOne({
      where: { chapter_id: chapterId, img_path: imgPath },
      attributes: ['id'],
    });
  }

  async getMaxSortOrder(chapterId) {
    return await this.model.max('sort_order', {
      where: { chapter_id: chapterId },
    });
  }
}

module.exports = new ChapterImageRepository();
