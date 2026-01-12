const BaseRepository = require('./base.repository');
const { stories: Story, categories: Category, chapters: Chapter } = require('../models');
const { Op } = require('sequelize');

class StoryRepository extends BaseRepository {
  constructor() {
    super(Story);
  }

  async findAndCountList({ page, limit, order, sort, keyword, status, categoryIds }) {
    const offset = (page - 1) * limit;
    let whereClause = {};

    if (keyword) {
      whereClause.name = { [Op.like]: `%${keyword}%` };
    }

    const ALLOWED_STATUS = ['coming_soon', 'ongoing', 'completed'];
    if (status && ALLOWED_STATUS.includes(status)) {
      whereClause.status = status;
    }

    let categoryInclude = {
      model: Category,
      as: 'category_id_categories',
      attributes: ['id', 'name'],
      through: { attributes: [] },
      required: false,
    };

    if (categoryIds) {
      const ids = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
      const safeIds = ids.map((v) => Number(v)).filter(Number.isInteger);

      if (safeIds.length) {
        categoryInclude = {
          ...categoryInclude,
          where: { id: { [Op.in]: safeIds } },
          required: true,
        };
      }
    }

    const chapterInclude = {
      model: Chapter,
      as: 'chapters',
      order: [['id', 'DESC']],
      limit: 3,
      separate: true,
      required: false,
    };

    const orderClause = this.buildOrderClause(sort, order);

    const result = await this.model.findAndCountAll({
      where: whereClause,
      include: [categoryInclude, chapterInclude],
      order: orderClause,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      distinct: true,
    });

    return result;
  }

  buildOrderClause(sort, order) {
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const sortWhitelist = ['id', 'name', 'total_view', 'total_follow', 'created_at', 'updated_at'];
    const isViewSort = sort === 'view_day' || sort === 'view_week' || sort === 'view_month' || sort === 'view_all';

    if (!isViewSort) {
      const sortColumn = sortWhitelist.includes(String(sort)) ? String(sort) : 'id';
      return [[sortColumn, sortOrder]];
    }
    
    if (sort === 'view_all') {
      return [
        ['total_view', sortOrder],
        ['updated_at', 'DESC'],
        ['id', 'DESC']
      ];
    }

    // Handle Time-based view sort
    const start = this.getStartAt(sort);
    const startStr = new Date(start).toISOString().slice(0, 19).replace('T', ' ');
    const escStart = this.model.sequelize.escape(startStr);

    const expr = `(SELECT COUNT(*) FROM story_views sv
                  WHERE sv.story_id = stories.id
                    AND sv.created_at >= ${escStart})`;
    
    return [
      [this.model.sequelize.literal(expr), sortOrder],
      ['updated_at', 'DESC'],
      ['id', 'DESC']
    ];
  }

  getStartAt(key) {
    const now = new Date();
    if (key === 'view_day') {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (key === 'view_week') {
      const d = new Date(now);
      const day = (d.getDay() + 6) % 7; // Monday=0
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (key === 'view_month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return null;
  }

  async findDetail(id) {
    return await this.model.findByPk(id, {
      include: [
        {
          model: Category,
          as: 'category_id_categories',
          attributes: ['id', 'name'],
          through: { attributes: [] },
          required: false,
        },
      ],
    });
  }
}

module.exports = new StoryRepository();
