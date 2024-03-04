const { commonFields } = require("./20230830123614_setup");

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema
    .raw(`CREATE EXTENSION IF NOT EXISTS postgis;`)
    .createTable("forms", (table) => {
      table.increments("id");
      table.integer("tenantId").unsigned();
      table.jsonb("visitDuration");
      table.integer("visitInfoId").unsigned();
      table.text("description");
      table.text("descriptionLT");
      table.text("nameLT");
      table.text("urlLT");
      table.text("name");
      table.jsonb("seasons");
      table.text("url");
      table.jsonb("additionalInfos");
      table.boolean("isPaid");
      table.jsonb("categories");
      table.jsonb("subCategories");
      table.boolean("isAdaptedForForeigners");
      table
        .enu(
          "status",
          ["CREATED", "RETURNED", "REJECTED", "APPROVED", "SUBMITTED"],
          { useNative: true, enumName: "form_status" }
        )
        .defaultTo("CREATED");
      table.jsonb("photos");
      table.timestamp("respondedAt");
      commonFields(table);
    })
    .raw(`ALTER TABLE forms ADD COLUMN geom geometry(point, 3346)`)
    .createTable("formHistories", (table) => {
      table.increments("id");
      table.integer("formId").unsigned().notNullable();
      table.enu(
        "type",
        ["CREATED", "UPDATED", "REJECTED", "RETURNED", "APPROVED"],
        { useNative: true, enumName: "form_history_type" }
      );
      table.text("comment");
      commonFields(table);
    })
    .raw(`CREATE INDEX forms_geom_idx ON forms USING GIST (geom)`);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable("forms").dropTable("formHistories");
};
