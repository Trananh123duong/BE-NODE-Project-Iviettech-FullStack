const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('user_follows', {
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    story_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'stories',
        key: 'id'
      }
    }
  }, {
    sequelize,
    tableName: 'user_follows',
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "user_id" },
          { name: "story_id" },
        ]
      },
      {
        name: "idx_uf_user",
        using: "BTREE",
        fields: [
          { name: "user_id" },
        ]
      },
      {
        name: "idx_uf_story",
        using: "BTREE",
        fields: [
          { name: "story_id" },
        ]
      },
    ]
  });
};
