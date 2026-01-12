const BaseRepository = require('./base.repository');
const { story_ratings: StoryRating, stories: Story } = require('../models');
const { fn, col } = require('sequelize');

class StoryRatingRepository extends BaseRepository {
  constructor() {
    super(StoryRating);
  }

  async upsertRating(storyId, userId, rating) {
    return await this.model.sequelize.transaction(async (t) => {
      const [row, created] = await this.model.findOrCreate({
        where: { story_id: storyId, user_id: userId },
        defaults: { story_id: storyId, user_id: userId, rating },
        transaction: t,
      });

      if (!created && row.rating !== rating) {
        row.rating = rating;
        await row.save({ transaction: t });
      }

      // Calculate new stats
      const agg = await this.model.findOne({
        where: { story_id: storyId },
        attributes: [
          [fn('AVG', col('rating')), 'avg'],
          [fn('COUNT', col('*')), 'cnt'],
        ],
        raw: true,
        transaction: t,
      });

      const avg = Number(agg.avg || 0).toFixed(2);
      const cnt = Number(agg.cnt || 0);

      // Update story directly inside transaction
      await Story.update(
        { avg_rating: avg, ratings_count: cnt },
        { where: { id: storyId }, transaction: t }
      );
    });
  }

  async getDistribution(storyId) {
    const dist = await this.model.findAll({
      where: { story_id: storyId },
      attributes: ['rating', [fn('COUNT', col('*')), 'count']],
      group: ['rating'],
      raw: true,
    });
    
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of dist) distribution[String(r.rating)] = Number(r.count);
    return distribution;
  }

  async getUserRating(storyId, userId) {
    if (!userId) return null;
    const r = await this.model.findOne({
      where: { story_id: storyId, user_id: userId },
      attributes: ['rating'],
      raw: true,
    });
    return r ? Number(r.rating) : null;
  }
}

module.exports = new StoryRatingRepository();
