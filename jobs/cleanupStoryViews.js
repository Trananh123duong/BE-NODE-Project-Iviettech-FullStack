const cron = require('node-cron')
const { Op } = require('sequelize')
const { story_views: StoryView } = require('../models')

// Job chạy 1 lần mỗi ngày lúc 03:00 sáng
cron.schedule('0 3 * * *', async () => {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)

    const deleted = await StoryView.destroy({
      where: {
        created_at: {
          [Op.lt]: cutoff
        }
      }
    })

    console.log(`[CLEANUP] Deleted ${deleted} old story_views at ${new Date().toISOString()}`)
  } catch (err) {
    console.error('[CLEANUP] Error cleaning story_views:', err)
  }
})
