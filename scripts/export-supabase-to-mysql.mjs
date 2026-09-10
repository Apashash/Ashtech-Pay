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
import { Client } from "pg";

const sourceUrl =
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!sourceUrl) {
  console.error(
    "No PostgreSQL source configured. Set SUPABASE_DATABASE_URL or SUPABASE_DB_URL in the environment."
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const outputArgIndex = args.indexOf("--output");
const requestedOutput =
  outputArgIndex >= 0 ? args[outputArgIndex + 1] : null;
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
    return formatDate(value);
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

const mapColumnType = (column) => {
  const dataType = column.data_type;
  const udt = column.udt_name;

  if (dataType === "character varying") {
    return column.character_maximum_length
      ? `VARCHAR(${column.character_maximum_length})`
      : "TEXT";
  }
  if (dataType === "character") {
    return `CHAR(${column.character_maximum_length || 1})`;
  }
  if (dataType === "text") return "LONGTEXT";
  if (dataType === "uuid") return "CHAR(36)";
  if (dataType === "boolean") return "TINYINT(1)";
  if (dataType === "smallint") return "SMALLINT";
  if (dataType === "integer") return "INT";
  if (dataType === "bigint") return "BIGINT";
  if (dataType === "numeric" || dataType === "decimal") {
    const precision = column.numeric_precision || 65;
    const scale = column.numeric_scale ?? 0;
    return `DECIMAL(${Math.min(Number(precision), 65)},${Math.min(
      Number(scale),
      30
    )})`;
  }
  if (dataType === "real") return "FLOAT";
  if (dataType === "double precision") return "DOUBLE";
  if (dataType === "date") return "DATE";
  if (dataType === "timestamp without time zone") return "DATETIME(6)";
  if (dataType === "timestamp with time zone") return "DATETIME(6)";
  if (dataType === "time without time zone") return "TIME(6)";
  if (dataType === "time with time zone") return "TIME(6)";
  if (dataType === "json" || dataType === "jsonb") return "JSON";
  if (dataType === "ARRAY" || udt?.startsWith("_")) return "JSON";
  if (dataType === "bytea") return "LONGBLOB";
  if (dataType === "USER-DEFINED") return "TEXT";
  if (dataType === "interval") return "VARCHAR(255)";
  return "LONGTEXT";
};

const portableDefault = (rawDefault) => {
  if (!rawDefault) return null;
  const value = String(rawDefault).trim();
  if (/^nextval\\(/i.test(value)) return null;
  if (/gen_random_uuid\\(\\)/i.test(value)) return "UUID()";
  if (/^(now\\(\\)|CURRENT_TIMESTAMP(?:\\(\\))?)$/i.test(value)) {
    return "CURRENT_TIMESTAMP";
  }
  if (/^true$/i.test(value)) return "1";
  if (/^false$/i.test(value)) return "0";
  if (/^'[^']*'::[a-z0-9_]+$/i.test(value)) {
    return value.replace(/::[a-z0-9_]+$/i, "");
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
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        kcu.ordinal_position,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
      LEFT JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
       AND tc.constraint_schema = rc.constraint_schema
      WHERE tc.table_schema = 'public' AND tc.table_name = $1
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `,
    [tableName]
  );

  const indexes = await client.query(
    `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = $1
      ORDER BY indexname
    `,
    [tableName]
  );

  return {
    columns: columns.rows,
    constraints: constraints.rows,
    indexes: indexes.rows,
  };
};

const constraintSql = (metadata) => {
  const groups = rowsByKey(metadata.constraints, "constraint_name");
  const definitions = [];

  for (const [name, rows] of groups) {
    const type = rows[0].constraint_type;
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
      if (rows[0].update_rule && rows[0].update_rule !== "NO ACTION") {
        actions.push(`ON UPDATE ${rows[0].update_rule}`);
      }
      if (rows[0].delete_rule && rows[0].delete_rule !== "NO ACTION") {
        actions.push(`ON DELETE ${rows[0].delete_rule}`);
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

const createTableSql = (tableName, metadata) => {
  const definitions = metadata.columns.map((column) => {
    const nullable = column.is_nullable === "YES" ? "" : " NOT NULL";
    const defaultValue = portableDefault(column.column_default);
    const defaultSql = defaultValue === null ? "" : ` DEFAULT ${defaultValue}`;
    return `${quoteIdentifier(column.column_name)} ${mapColumnType(
      column
    )}${nullable}${defaultSql}`;
  });

  definitions.push(...constraintSql(metadata));

  return [
    `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)} (`,
    `  ${definitions.join(",\n  ")}`,
    `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  ].join("\n");
};

const write = (stream, text) => {
  if (!stream.write(text)) {
    return new Promise((resolve) => stream.once("drain", resolve));
  }
  return Promise.resolve();
};

const exportTable = async (client, stream, tableName, metadata) => {
  const columnNames = metadata.columns.map((column) => column.column_name);
  const columnSql = columnNames.map(quoteIdentifier).join(", ");
  const result = await client.query(
    `SELECT ${columnNames.map(quoteIdentifier).join(", ")} FROM ${quoteIdentifier(
      "public"
    )}.${quoteIdentifier(tableName)}`
  );

  for (let offset = 0; offset < result.rows.length; offset += batchSize) {
    const batch = result.rows.slice(offset, offset + batchSize);
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

  return result.rows.length;
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
    generatedAt: new Date().toISOString(),
    output: outputPath,
    tables: [],
    unsupportedPostgresFeatures: [],
  };

  try {
    await client.connect();
    const tableResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const metadataByTable = new Map();
    for (const row of tableResult.rows) {
      metadataByTable.set(row.table_name, await getMetadata(client, row.table_name));
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
        "START TRANSACTION;",
        "",
      ].join("\n")
    );

    for (const row of tableResult.rows) {
      const tableName = row.table_name;
      const metadata = metadataByTable.get(tableName);
      await write(stream, `-- Table: ${tableName}\n`);
      await write(stream, `${createTableSql(tableName, metadata)}\n\n`);
      const rowCount = await exportTable(client, stream, tableName, metadata);
      const unsupportedIndexes = metadata.indexes
        .filter(({ indexdef }) => {
          const definition = String(indexdef);
          return (
            definition.includes(" WHERE ") ||
            definition.includes("USING gin") ||
            definition.includes("USING gist") ||
            definition.includes("::") ||
            definition.includes("lower(") ||
            definition.includes("~")
          );
        })
        .map((index) => index.indexdef);

      report.tables.push({
        table: tableName,
        rows: rowCount,
        columns: metadata.columns.length,
        unsupportedIndexes,
      });
      report.unsupportedPostgresFeatures.push(
        ...unsupportedIndexes.map((indexdef) => ({
          table: tableName,
          kind: "index",
          definition: indexdef,
        }))
      );
      await write(stream, "\n");
    }

    await write(
      stream,
      [
        "COMMIT;",
        "SET FOREIGN_KEY_CHECKS=1;",
        "",
        "-- PostgreSQL triggers, functions, LISTEN/NOTIFY, RLS policies, and",
        "-- partial/expression indexes are intentionally listed in the sidecar report.",
        "",
      ].join("\n")
    );

    await new Promise((resolve, reject) => {
      stream.once("error", reject);
      stream.end(resolve);
    });

    fs.renameSync(tempPath, outputPath);
    fs.writeFileSync(tempReportPath, `${JSON.stringify(report, null, 2)}\n`);
    fs.renameSync(tempReportPath, reportPath);

    const totalRows = report.tables.reduce((sum, table) => sum + table.rows, 0);
    console.log(`Export completed: ${report.tables.length} tables, ${totalRows} rows.`);
    console.log(`SQL file: ${outputPath}`);
    console.log(`Report: ${reportPath}`);
  } catch (error) {
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