#!/usr/bin/env node

/**
 * Read-only Supabase/PostgreSQL -> MySQL/MariaDB data exporter.
 *
 * This script never mutates the source database. It writes a self-contained
 * SQL dump containing the public schema, data, and portable constraints.
 * PostgreSQL-only triggers, functions, partial indexes, and RLS policies are
 * written to a sidecar report for manual review instead of being silently
 * dropped into MySQL SQL.
 */

import fs from "node:fs";
import path from "node:path";
import { Client, types } from "pg";

// Keep PostgreSQL temporal values as text so the exporter does not apply the
// Node process timezone before writing the MySQL dump.
for (const oid of [1082, 1083, 1114, 1184, 1266]) {
  types.setTypeParser(oid, (value) => value);
}

const args = process.argv.slice(2);
const outputArgIndex = args.indexOf("--output");
const requestedOutput =
  outputArgIndex >= 0 ? args[outputArgIndex + 1] : null;
const allowGenericDatabaseUrl = args.includes("--allow-generic-database-url");
const sourceEnvName = process.env.SUPABASE_DB_URL
  ? "SUPABASE_DB_URL"
  : process.env.SUPABASE_DATABASE_URL
    ? "SUPABASE_DATABASE_URL"
    : process.env.DATABASE_URL
      ? "DATABASE_URL"
      : null;
const sourceUrl = sourceEnvName ? process.env[sourceEnvName] : null;

if (!sourceUrl) {
  console.error(
    "No PostgreSQL source configured. Set SUPABASE_DATABASE_URL or SUPABASE_DB_URL in the environment."
  );
  process.exit(1);
}

if (sourceEnvName === "DATABASE_URL" && !allowGenericDatabaseUrl) {
  console.error(
    "Refusing generic DATABASE_URL. Confirm it points to Supabase and rerun with --allow-generic-database-url."
  );
  process.exit(1);
}

const outputPath = path.resolve(
  requestedOutput || path.join("exports", "ashtechpay-supabase-mysql.sql")
);
const reportPath = `${outputPath}.report.json`;
const batchSize = 500;

if (!requestedOutput && args.includes("--output")) {
  console.error("--output requires a file path.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const tempPath = `${outputPath}.part`;
const tempReportPath = `${reportPath}.part`;

const quoteIdentifier = (value) => `\`${String(value).replaceAll("`", "``")}\``;
const quotePgIdentifier = (value) =>
  `"${String(value).replaceAll('"', '""')}"`;

const quoteString = (value) => {
  const text = String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("\0", "\\0")
    .replaceAll("\b", "\\b")
    .replaceAll("\t", "\\t")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("\x1a", "\\Z")
    .replaceAll("'", "\\'");
  return `'${text}'`;
};

const formatDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return quoteString(value);
  return quoteString(date.toISOString().replace("T", " ").replace("Z", ""));
};

const formatTemporalValue = (value, column) => {
  const text = String(value);
  if (column.data_type === "date" || column.data_type === "time without time zone") {
    return quoteString(text);
  }
  if (column.data_type === "time with time zone") {
    return quoteString(text);
  }
  if (column.data_type === "timestamp without time zone") {
    return quoteString(text.replace("T", " ").replace(/Z$/, ""));
  }
  return formatDate(text);
};

const formatValue = (value, column) => {
  if (value === null || value === undefined) return "NULL";
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  if (
    column.data_type === "timestamp without time zone" ||
    column.data_type === "timestamp with time zone" ||
    column.data_type === "date" ||
    column.data_type === "time without time zone" ||
    column.data_type === "time with time zone"
  ) {
    return formatTemporalValue(value, column);
  }
  if (column.data_type === "json" || column.data_type === "jsonb") {
    const json = typeof value === "string" ? value : JSON.stringify(value);
    return quoteString(json);
  }
  if (column.data_type === "ARRAY" || column.udt_name?.startsWith("_")) {
    return quoteString(JSON.stringify(value));
  }
  if (typeof value === "object") return quoteString(JSON.stringify(value));
  return quoteString(value);
};

const mapColumnType = (column, boundedForKey = false) => {
  const dataType = column.data_type;
  const udt = column.udt_name;

  if (dataType === "character varying") {
    return column.character_maximum_length
      ? `VARCHAR(${column.character_maximum_length})`
      : boundedForKey
        ? "VARCHAR(255)"
        : "TEXT";
  }
  if (dataType === "character") {
    return `CHAR(${column.character_maximum_length || 1})`;
  }
  if (dataType === "text") {
    return boundedForKey ? "VARCHAR(255)" : "LONGTEXT";
  }
  if (dataType === "uuid") return "CHAR(36)";
  if (dataType === "boolean") return "TINYINT(1)";
  if (dataType === "smallint") return "SMALLINT";
  if (dataType === "integer") return "INT";
  if (dataType === "bigint") return "BIGINT";
  if (dataType === "numeric" || dataType === "decimal") {
    const precision = Number(column.numeric_precision);
    const scale = Number(column.numeric_scale);
    if (
      !Number.isInteger(precision) ||
      !Number.isInteger(scale) ||
      precision < 1 ||
      precision > 65 ||
      scale < 0 ||
      scale > 30 ||
      scale > precision
    ) {
      return "LONGTEXT";
    }
    return `DECIMAL(${precision},${scale})`;
  }
  if (dataType === "real") return "FLOAT";
  if (dataType === "double precision") return "DOUBLE";
  if (dataType === "date") return "DATE";
  if (dataType === "timestamp without time zone") return "DATETIME(6)";
  if (dataType === "timestamp with time zone") return "DATETIME(6)";
  if (dataType === "time without time zone") return "TIME(6)";
  if (dataType === "time with time zone") return "VARCHAR(32)";
  if (dataType === "json" || dataType === "jsonb") return "JSON";
  if (dataType === "ARRAY" || udt?.startsWith("_")) return "JSON";
  if (dataType === "bytea") return "LONGBLOB";
  if (dataType === "USER-DEFINED") return "TEXT";
  if (dataType === "interval") return "VARCHAR(255)";
  return "LONGTEXT";
};

const portableDefault = (rawDefault, column = null) => {
  if (!rawDefault) return null;
  const value = String(rawDefault).trim();
  if (column && ["json", "jsonb", "ARRAY"].includes(column.data_type)) {
    return null;
  }
  if (/^nextval\(/i.test(value)) return null;
  if (/gen_random_uuid\(\)/i.test(value)) return "UUID()";
  if (/^(now\(\)|CURRENT_TIMESTAMP(?:\(\))?)$/i.test(value)) {
    return "CURRENT_TIMESTAMP";
  }
  if (/^CURRENT_DATE$/i.test(value)) return "CURRENT_DATE";
  if (/^true$/i.test(value)) return "1";
  if (/^false$/i.test(value)) return "0";
  if (/^'(true|false)'::boolean$/i.test(value)) {
    return value.toLowerCase().includes("true") ? "1" : "0";
  }
  if (/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
    return value;
  }
  if (
    /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?::[a-z0-9_." ]+$/i.test(
      value
    )
  ) {
    return value.replace(/::[a-z0-9_." ]+$/i, "");
  }
  if (/^'(?:''|[^'])*'::[a-z0-9_." ]+(?:\[\])?$/i.test(value)) {
    return value.replace(/::[a-z0-9_." ]+(?:\[\])?$/i, "");
  }
  if (/^'[^']*'$/i.test(value)) return value;
  return null;
};

const rowsByKey = (rows, key) => {
  const grouped = new Map();
  for (const row of rows) {
    const list = grouped.get(row[key]) || [];
    list.push(row);
    grouped.set(row[key], list);
  }
  return grouped;
};

const getMetadata = async (client, tableName) => {
  const columns = await client.query(
    `
      SELECT column_name, data_type, udt_name, is_nullable,
             column_default, character_maximum_length,
             numeric_precision, numeric_scale, ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
    [tableName]
  );

  const constraints = await client.query(
    `
      SELECT
        con.conname AS constraint_name,
        CASE con.contype
          WHEN 'p' THEN 'PRIMARY KEY'
          WHEN 'u' THEN 'UNIQUE'
          WHEN 'f' THEN 'FOREIGN KEY'
        END AS constraint_type,
        local_att.attname AS column_name,
        key_column.ordinal_position,
        foreign_table.relname AS foreign_table_name,
        foreign_att.attname AS foreign_column_name,
        CASE con.confupdtype
          WHEN 'a' THEN 'NO ACTION'
          WHEN 'r' THEN 'RESTRICT'
          WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL'
          WHEN 'd' THEN 'SET DEFAULT'
        END AS update_rule,
        CASE con.confdeltype
          WHEN 'a' THEN 'NO ACTION'
          WHEN 'r' THEN 'RESTRICT'
          WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL'
          WHEN 'd' THEN 'SET DEFAULT'
        END AS delete_rule
      FROM pg_constraint con
      JOIN pg_class local_table ON local_table.oid = con.conrelid
      JOIN pg_namespace local_schema ON local_schema.oid = local_table.relnamespace
      JOIN LATERAL unnest(con.conkey) WITH ORDINALITY
        AS key_column(attnum, ordinal_position) ON TRUE
      JOIN pg_attribute local_att
        ON local_att.attrelid = local_table.oid
       AND local_att.attnum = key_column.attnum
      LEFT JOIN pg_class foreign_table ON foreign_table.oid = con.confrelid
      LEFT JOIN LATERAL unnest(con.confkey) WITH ORDINALITY
        AS foreign_key(attnum, ordinal_position)
        ON foreign_key.ordinal_position = key_column.ordinal_position
      LEFT JOIN pg_attribute foreign_att
        ON foreign_att.attrelid = foreign_table.oid
       AND foreign_att.attnum = foreign_key.attnum
      WHERE local_schema.nspname = 'public'
        AND local_table.relname = $1
        AND con.contype IN ('p', 'u', 'f')
      ORDER BY con.conname, key_column.ordinal_position
    `,
    [tableName]
  );

  const indexes = await client.query(
    `
      SELECT
        index_table.relname AS index_name,
        index_def.indexdef,
        access_method.amname,
        index_info.indisunique AS is_unique,
        index_info.indisprimary AS is_primary,
        (index_info.indpred IS NOT NULL) AS is_partial,
        COALESCE(index_columns.columns, ARRAY[]::text[]) AS columns,
        COALESCE(index_columns.has_expression, FALSE) AS has_expression
      FROM pg_index index_info
      JOIN pg_class table_ref ON table_ref.oid = index_info.indrelid
      JOIN pg_namespace table_schema ON table_schema.oid = table_ref.relnamespace
      JOIN pg_class index_table ON index_table.oid = index_info.indexrelid
      JOIN pg_am access_method ON access_method.oid = index_table.relam
      JOIN LATERAL (
        SELECT pg_get_indexdef(index_info.indexrelid) AS indexdef
      ) index_def ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          array_agg(attribute.attname::text ORDER BY key_column.ordinality)
            FILTER (WHERE attribute.attname IS NOT NULL) AS columns,
          bool_or(key_column.attnum = 0) AS has_expression
        FROM unnest(index_info.indkey) WITH ORDINALITY
          AS key_column(attnum, ordinality)
        LEFT JOIN pg_attribute attribute
          ON attribute.attrelid = index_info.indrelid
         AND attribute.attnum = key_column.attnum
      ) index_columns ON TRUE
      WHERE table_schema.nspname = 'public'
        AND table_ref.relname = $1
      ORDER BY index_table.relname
    `,
    [tableName]
  );

  return {
    columns: columns.rows,
    constraints: constraints.rows,
    indexes: indexes.rows,
  };
};

const getUnsupportedDatabaseFeatures = async (client) => {
  const features = [];
  const triggers = await client.query(`
    SELECT trigger_name, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY trigger_name
  `);
  const routines = await client.query(`
    SELECT routine_name, routine_type
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    ORDER BY routine_name
  `);
  const policies = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `);

  for (const trigger of triggers.rows) {
    features.push({
      kind: "trigger",
      table: trigger.event_object_table,
      name: trigger.trigger_name,
      definition: trigger.action_statement,
    });
  }
  for (const routine of routines.rows) {
    features.push({
      kind: "routine",
      name: routine.routine_name,
      routineType: routine.routine_type,
    });
  }
  for (const policy of policies.rows) {
    features.push({
      kind: "row-level-security",
      table: policy.tablename,
      name: policy.policyname,
      command: policy.cmd,
      roles: policy.roles,
    });
  }
  features.push({
    kind: "supabase-storage",
    detail:
      "Storage objects and files are outside PostgreSQL and require a separate inventory/copy/verification.",
  });
  return features;
};

const constraintSql = (metadata, kind = null) => {
  const groups = rowsByKey(metadata.constraints, "constraint_name");
  const definitions = [];

  for (const [name, rows] of groups) {
    const type = rows[0].constraint_type;
    if (kind === "keys" && type === "FOREIGN KEY") continue;
    if (kind === "foreign-keys" && type !== "FOREIGN KEY") continue;
    const columns = rows
      .sort((a, b) => a.ordinal_position - b.ordinal_position)
      .map((row) => quoteIdentifier(row.column_name))
      .join(", ");

    if (type === "PRIMARY KEY") {
      definitions.push(`PRIMARY KEY (${columns})`);
    } else if (type === "UNIQUE") {
      definitions.push(`UNIQUE KEY ${quoteIdentifier(name)} (${columns})`);
    } else if (type === "FOREIGN KEY") {
      const foreignTable = rows[0].foreign_table_name;
      const foreignColumns = rows
        .sort((a, b) => a.ordinal_position - b.ordinal_position)
        .map((row) => quoteIdentifier(row.foreign_column_name))
        .join(", ");
      const actions = [];
      if (
        rows[0].update_rule &&
        rows[0].update_rule !== "NO ACTION" &&
        rows[0].update_rule !== "SET DEFAULT"
      ) {
        actions.push(`ON UPDATE ${rows[0].update_rule}`);
      }
      if (rows[0].delete_rule && rows[0].delete_rule !== "NO ACTION") {
        if (rows[0].delete_rule !== "SET DEFAULT") {
          actions.push(`ON DELETE ${rows[0].delete_rule}`);
        }
      }
      definitions.push(
        `CONSTRAINT ${quoteIdentifier(name)} FOREIGN KEY (${columns}) REFERENCES ${quoteIdentifier(
          foreignTable
        )} (${foreignColumns})${actions.length ? ` ${actions.join(" ")}` : ""}`
      );
    }
  }

  return definitions;
};

const mysqlKeyColumns = (metadata) => {
  const columns = new Set(
    metadata.constraints.map((constraint) => constraint.column_name)
  );
  for (const index of metadata.indexes) {
    for (const column of index.columns || []) columns.add(column);
  }
  return columns;
};

const createTableSql = (tableName, metadata) => {
  const keyColumns = mysqlKeyColumns(metadata);
  const definitions = metadata.columns.map((column) => {
    const nullable = column.is_nullable === "YES" ? "" : " NOT NULL";
    const defaultValue = portableDefault(column.column_default, column);
    const defaultSql = defaultValue === null ? "" : ` DEFAULT ${defaultValue}`;
    return `${quoteIdentifier(column.column_name)} ${mapColumnType(
      column,
      keyColumns.has(column.column_name)
    )}${nullable}${defaultSql}`;
  });

  return [
    `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)} (`,
    `  ${definitions.join(",\n  ")}`,
    `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  ].join("\n");
};

const alterConstraintSql = (tableName, metadata, kind) =>
  constraintSql(metadata, kind)
    .filter((definition) => !definition.startsWith("/*"))
    .map(
      (definition) =>
        `ALTER TABLE ${quoteIdentifier(tableName)} ADD ${definition};`
    );

const indexConstraintNames = (metadata) =>
  new Set(metadata.constraints.map((constraint) => constraint.constraint_name));

const portableIndexSql = (tableName, metadata) => {
  const constrainedIndexes = indexConstraintNames(metadata);
  const columnByName = new Map(
    metadata.columns.map((column) => [column.column_name, column])
  );
  const keyColumns = mysqlKeyColumns(metadata);
  const portable = [];
  const unsupported = [];

  for (const index of metadata.indexes) {
    if (index.is_primary || constrainedIndexes.has(index.index_name)) continue;

    let reason = null;
    if (index.is_partial) reason = "partial index";
    else if (index.has_expression) reason = "expression index";
    else if (index.amname !== "btree") {
      reason = `PostgreSQL access method ${index.amname}`;
    } else if (!index.columns?.length) {
      reason = "index has no portable column list";
    } else {
      const indexedTypes = index.columns.map((name) =>
        mapColumnType(
          columnByName.get(name),
          keyColumns.has(name)
        )
      );
      if (
        indexedTypes.some((type) => ["JSON", "LONGBLOB"].includes(type))
      ) {
        reason = "index includes JSON or binary data";
      } else if (
        indexedTypes.some((type) => ["TEXT", "LONGTEXT"].includes(type))
      ) {
        reason = "index includes an unbounded text-like column";
      }
    }

    if (reason) {
      unsupported.push({
        index: index.index_name,
        definition: index.indexdef,
        reason,
      });
      continue;
    }

    portable.push(
      `CREATE ${index.is_unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(
        index.index_name
      )} ON ${quoteIdentifier(tableName)} (${index.columns
        .map(quoteIdentifier)
        .join(", ")});`
    );
  }

  return { portable, unsupported };
};

const conversionWarnings = (tableName, metadata) => {
  const warnings = [];
  for (const column of metadata.columns) {
    const mappedType = mapColumnType(column);
    if (
      column.column_default &&
      portableDefault(column.column_default, column) === null
    ) {
      warnings.push({
        table: tableName,
        column: column.column_name,
        kind: "default",
        detail: `Default omitted: ${column.column_default}`,
      });
    }
    if (column.data_type === "ARRAY" || column.udt_name?.startsWith("_")) {
      warnings.push({
        table: tableName,
        column: column.column_name,
        kind: "array",
        detail: "PostgreSQL array exported as JSON.",
      });
    }
    if (column.data_type === "timestamp with time zone") {
      warnings.push({
        table: tableName,
        column: column.column_name,
        kind: "timestamp-with-time-zone",
        detail: "Instant normalized to UTC DATETIME(6); MySQL does not retain the original timezone offset.",
      });
    }
    if (column.data_type === "time with time zone") {
      warnings.push({
        table: tableName,
        column: column.column_name,
        kind: "time-with-time-zone",
        detail: "Stored as VARCHAR(32) to preserve the offset.",
      });
    }
    if (
      (column.data_type === "numeric" || column.data_type === "decimal") &&
      mappedType === "LONGTEXT"
    ) {
      warnings.push({
        table: tableName,
        column: column.column_name,
        kind: "numeric",
        detail: "Numeric precision/scale is outside MySQL DECIMAL limits; value preserved as text.",
      });
    }
    if (column.data_type === "USER-DEFINED") {
      warnings.push({
        table: tableName,
        column: column.column_name,
        kind: "user-defined-type",
        detail: "PostgreSQL user-defined type exported as LONGTEXT.",
      });
    }
    if (/^nextval\(/i.test(String(column.column_default || "").trim())) {
      warnings.push({
        table: tableName,
        column: column.column_name,
        kind: "sequence",
        detail: "PostgreSQL sequence default omitted; review AUTO_INCREMENT or an application-side ID generator.",
      });
    }
  }

  for (const constraint of metadata.constraints) {
    if (
      constraint.update_rule === "SET DEFAULT" ||
      constraint.delete_rule === "SET DEFAULT"
    ) {
      warnings.push({
        table: tableName,
        constraint: constraint.constraint_name,
        kind: "foreign-key-action",
        detail: "MySQL/InnoDB does not support PostgreSQL SET DEFAULT actions; the action was omitted.",
      });
    }
  }

  return warnings;
};

const write = (stream, text) => {
  if (!stream.write(text)) {
    return new Promise((resolve) => stream.once("drain", resolve));
  }
  return Promise.resolve();
};

let cursorSequence = 0;

const exportTable = async (client, stream, tableName, metadata) => {
  const columnNames = metadata.columns.map((column) => column.column_name);
  const columnSql = columnNames.map(quoteIdentifier).join(", ");
  const cursorName = `ashtech_export_${++cursorSequence}`;
  const cursorSql = quotePgIdentifier(cursorName);
  let rowCount = 0;

  await client.query(
    `DECLARE ${cursorSql} NO SCROLL CURSOR FOR SELECT ${columnNames
      .map(quotePgIdentifier)
      .join(", ")} FROM ${quotePgIdentifier("public")}.${quotePgIdentifier(
      tableName
    )}`
  );

  try {
    while (true) {
      const result = await client.query(
        `FETCH FORWARD ${batchSize} FROM ${cursorSql}`
      );
      if (result.rows.length === 0) break;
      rowCount += result.rows.length;
      const batch = result.rows;
    const values = batch
      .map(
        (row) =>
          `(${metadata.columns
            .map((column) => formatValue(row[column.column_name], column))
            .join(", ")})`
      )
      .join(",\n");
    await write(
      stream,
      `INSERT INTO ${quoteIdentifier(tableName)} (${columnSql}) VALUES\n${values};\n`
      );
    }
  } finally {
    await client.query(`CLOSE ${cursorSql}`).catch(() => {});
  }

  return rowCount;
};

const main = async () => {
  const client = new Client({
    connectionString: sourceUrl,
    ssl: sourceUrl.includes("localhost") ||
      sourceUrl.includes("127.0.0.1") ||
      sourceUrl.includes("sslmode=disable")
      ? undefined
      : { rejectUnauthorized: false },
  });

  const report = {
    source: "PostgreSQL/Supabase",
    sourceVariable: sourceEnvName,
    generatedAt: new Date().toISOString(),
    output: outputPath,
    tables: [],
    conversions: [],
    unsupportedPostgresFeatures: [],
  };

  let sourceTransactionOpen = false;
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    sourceTransactionOpen = true;
    const tableResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    report.unsupportedPostgresFeatures.push(
      ...(await getUnsupportedDatabaseFeatures(client))
    );

    const metadataByTable = new Map();
    for (const row of tableResult.rows) {
      const metadata = await getMetadata(client, row.table_name);
      metadataByTable.set(row.table_name, metadata);
      report.conversions.push(...conversionWarnings(row.table_name, metadata));
    }

    const stream = fs.createWriteStream(tempPath, { encoding: "utf8" });
    await write(
      stream,
      [
        "-- AshTech Pay: read-only PostgreSQL/Supabase -> MySQL/MariaDB export",
        `-- Generated: ${new Date().toISOString()}`,
        "-- Source data is preserved as exported; review the sidecar report before import.",
        "SET NAMES utf8mb4;",
        "SET FOREIGN_KEY_CHECKS=0;",
        "-- DDL statements are deliberately not wrapped in START TRANSACTION;",
        "-- MySQL/MariaDB may implicitly commit DDL.",
        "",
      ].join("\n")
    );

    // Phase 1: create every table without keys. This removes table-order
    // coupling and guarantees that all referenced tables exist before data
    // and constraints are emitted.
    for (const row of tableResult.rows) {
      const tableName = row.table_name;
      const metadata = metadataByTable.get(tableName);
      await write(stream, `-- Table: ${tableName}\n`);
      await write(stream, `${createTableSql(tableName, metadata)}\n\n`);
    }

    // Phase 2: export rows while the repeatable-read source snapshot remains
    // open. A PostgreSQL cursor keeps memory bounded for large tables.
    for (const row of tableResult.rows) {
      const tableName = row.table_name;
      const metadata = metadataByTable.get(tableName);
      const rowCount = await exportTable(client, stream, tableName, metadata);
      const indexes = portableIndexSql(tableName, metadata);

      report.tables.push({
        table: tableName,
        rows: rowCount,
        columns: metadata.columns.length,
        portableIndexes: indexes.portable.length,
        unsupportedIndexes: indexes.unsupported,
      });
      await write(stream, "\n");
    }

    // Phase 3: keys can be added after all rows are present. Primary and
    // unique keys come first because foreign keys reference them.
    await write(stream, "-- Primary and unique constraints\n");
    for (const row of tableResult.rows) {
      const metadata = metadataByTable.get(row.table_name);
      for (const statement of alterConstraintSql(row.table_name, metadata, "keys")) {
        await write(stream, `${statement}\n`);
      }
    }
    await write(stream, "\n-- Foreign keys\n");
    for (const row of tableResult.rows) {
      const metadata = metadataByTable.get(row.table_name);
      for (const statement of alterConstraintSql(
        row.table_name,
        metadata,
        "foreign-keys"
      )) {
        await write(stream, `${statement}\n`);
      }
    }

    // Phase 4: secondary indexes are last so import performance is not
    // penalized while bulk rows are being inserted.
    await write(stream, "\n-- Portable secondary indexes\n");
    for (const row of tableResult.rows) {
      const metadata = metadataByTable.get(row.table_name);
      const indexes = portableIndexSql(row.table_name, metadata);
      for (const statement of indexes.portable) {
        await write(stream, `${statement}\n`);
      }
      report.unsupportedPostgresFeatures.push(
        ...indexes.unsupported.map((index) => ({
          table: row.table_name,
          kind: "index",
          ...index,
        }))
      );
    }

    await write(
      stream,
      [
        "SET FOREIGN_KEY_CHECKS=1;",
        "",
        "-- PostgreSQL triggers, functions, LISTEN/NOTIFY, RLS policies, and",
        "-- unsupported indexes are listed in the sidecar report.",
        "",
      ].join("\n")
    );

    await new Promise((resolve, reject) => {
      stream.once("error", reject);
      stream.end(resolve);
    });

    await client.query("COMMIT");
    sourceTransactionOpen = false;
    fs.renameSync(tempPath, outputPath);
    fs.writeFileSync(tempReportPath, `${JSON.stringify(report, null, 2)}\n`);
    fs.renameSync(tempReportPath, reportPath);

    const totalRows = report.tables.reduce((sum, table) => sum + table.rows, 0);
    console.log(`Export completed: ${report.tables.length} tables, ${totalRows} rows.`);
    console.log(`SQL file: ${outputPath}`);
    console.log(`Report: ${reportPath}`);
  } catch (error) {
    if (sourceTransactionOpen) {
      await client.query("ROLLBACK").catch(() => {});
    }
    try {
      fs.rmSync(tempPath, { force: true });
      fs.rmSync(tempReportPath, { force: true });
    } catch {}
    console.error(
      `Export failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
};

await main();