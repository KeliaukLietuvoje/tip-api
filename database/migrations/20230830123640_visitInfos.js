const { commonFields } = require("./20230830123614_setup");

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("visitInfos", (table) => {
    table.increments("id");
    table.text("name");
    commonFields(table);
  });
};
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable("visitInfos");
};
