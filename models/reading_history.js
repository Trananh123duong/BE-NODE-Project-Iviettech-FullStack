const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('reading_history', {
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    story_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'stories',
        key: 'id'
      }
    },
    chapter_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'chapters',
        key: 'id'
      }
    },
    last_read_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'reading_history',
    timestamps: false,
    indexes: [
      {
        name: "uk_user_story",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "user_id" },
          { name: "story_id" },
        ]
      },
      {
        name: "idx_rh_user_time",
        using: "BTREE",
        fields: [
          { name: "user_id" },
          { name: "last_read_at" },
        ]
      },
      {
        name: "idx_rh_story",
        using: "BTREE",
        fields: [
          { name: "story_id" },
        ]
      },
      {
        name: "idx_rh_chapter",
        using: "BTREE",
        fields: [
          { name: "chapter_id" },
        ]
      },
    ]
  });
};
