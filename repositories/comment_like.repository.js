const BaseRepository = require('./base.repository');
const { comment_likes: CommentLike } = require('../models');
const { Op, fn, col } = require('sequelize');

class CommentLikeRepository extends BaseRepository {
  constructor() {
    super(CommentLike);
  }

  async getLikeCounts(commentIds) {
    if (!commentIds || commentIds.length === 0) return new Map();

    const likeCounts = await this.model.findAll({
      where: { comment_id: { [Op.in]: commentIds } },
      attributes: ['comment_id', [fn('COUNT', col('*')), 'cnt']],
      group: ['comment_id'],
      raw: true,
    });

    const map = new Map();
    for (const row of likeCounts) {
      map.set(Number(row.comment_id), Number(row.cnt));
    }
    return map;
  }

  async getUserLikedSet(userId, commentIds) {
    if (!userId || !commentIds || commentIds.length === 0) return new Set();

    const likedRows = await this.model.findAll({
      where: { user_id: userId, comment_id: { [Op.in]: commentIds } },
      attributes: ['comment_id'],
      raw: true,
    });

    return new Set(likedRows.map(r => Number(r.comment_id)));
  }
}

module.exports = new CommentLikeRepository();
