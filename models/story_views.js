const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('story_views', {
    id: {
      autoIncrement: true,
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      primaryKey: true
    },
    story_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'stories',
        key: 'id'
      }
    }
  }, {
    sequelize,
    tableName: 'story_views',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "idx_sv_story_time",
        using: "BTREE",
        fields: [
          { name: "story_id" },
          { name: "created_at" },
        ]
      },
      {
        name: "idx_sv_time",
        using: "BTREE",
        fields: [
          { name: "created_at" },
        ]
      },
      {
        name: "idx_sv_user_story_time",
        using: "BTREE",
        fields: [
          { name: "story_id" },
          { name: "created_at" },
        ]
      },
    ]
  });
};
