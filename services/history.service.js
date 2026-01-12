const HistoryRepository = require('../repositories/history.repository');

class HistoryService {
  async listMyHistory(userId, query) {
    const { page = 1, limit = 10, keyword } = query;
    const offset = (Number(page) - 1) * Number(limit);

    const result = await HistoryRepository.findUserHistory(userId, {
      limit: Number(limit),
      offset,
      keyword
    });

    const totalPages = Math.ceil(result.count / parseInt(limit, 10));

    return {
      data: result.rows,
      meta: {
        total: result.count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages,
      },
    };
  }

  async deleteMyHistoryItem(id, userId) {
    const deleted = await HistoryRepository.deleteUserHistory(id, userId);

    return {
      message: deleted ? 'Đã xoá lịch sử truyện' : 'Không tìm thấy trong lịch sử',
    };
  }
}

module.exports = new HistoryService();
