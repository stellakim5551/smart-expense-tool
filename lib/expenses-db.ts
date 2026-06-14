import fs from "node:fs";
import path from "node:path";
import initSqlJs, { Database, SqlJsStatic } from "sql.js";

export type Expense = {
  id: number;
  date: string;
  description: string;
  amount: number;
  created_at: string;
};

export type ExpenseInput = {
  date: string;
  description: string;
  amount: number;
};

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "expenses.sqlite");

let sqlPromise: Promise<SqlJsStatic> | null = null;

function getSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) =>
        path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
    });
  }

  return sqlPromise;
}

function ensureSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

async function openDb() {
  const SQL = await getSql();
  fs.mkdirSync(dataDir, { recursive: true });

  const db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();

  ensureSchema(db);
  return db;
}

function saveDb(db: Database) {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

async function withDb<T>(work: (db: Database) => T, persist = false) {
  const db = await openDb();

  try {
    const result = work(db);
    if (persist) {
      saveDb(db);
    }

    return result;
  } finally {
    db.close();
  }
}

function rowToExpense(row: unknown[]): Expense {
  return {
    id: Number(row[0]),
    date: String(row[1]),
    description: String(row[2]),
    amount: Number(row[3]),
    created_at: String(row[4]),
  };
}

export async function listExpenses() {
  return withDb((db) => {
    const result = db.exec(
      "SELECT id, date, description, amount, created_at FROM expenses ORDER BY date DESC, id DESC"
    );

    return result[0]?.values.map(rowToExpense) ?? [];
  });
}

export async function listExpensesByMonth(month: string) {
  return withDb((db) => {
    const statement = db.prepare(`
      SELECT id, date, description, amount, created_at
      FROM expenses
      WHERE substr(date, 1, 7) = ?
      ORDER BY date ASC, id ASC
    `);

    statement.bind([month]);
    const rows: Expense[] = [];
    while (statement.step()) {
      rows.push(rowToExpense(statement.get()));
    }
    statement.free();

    return rows;
  });
}

export async function listExpensesByDateRange(startDate: string, endDate: string) {
  return withDb((db) => {
    const statement = db.prepare(`
      SELECT id, date, description, amount, created_at
      FROM expenses
      WHERE date >= ? AND date <= ?
      ORDER BY date ASC, id ASC
    `);

    statement.bind([startDate, endDate]);
    const rows: Expense[] = [];
    while (statement.step()) {
      rows.push(rowToExpense(statement.get()));
    }
    statement.free();

    return rows;
  });
}

export async function getMonthlyTotal(month: string) {
  return withDb((db) => {
    const statement = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE substr(date, 1, 7) = ?"
    );

    statement.bind([month]);
    const total = statement.step() ? Number(statement.get()[0]) : 0;
    statement.free();

    return total;
  });
}

export async function createExpense(input: ExpenseInput) {
  return withDb((db) => {
    const statement = db.prepare(`
      INSERT INTO expenses (date, description, amount, created_at)
      VALUES (?, ?, ?, ?)
    `);

    statement.run([
      input.date,
      input.description.trim(),
      input.amount,
      new Date().toISOString(),
    ]);
    statement.free();

    return db.exec("SELECT last_insert_rowid() AS id")[0].values[0][0] as number;
  }, true);
}

export async function updateExpense(id: number, input: ExpenseInput) {
  return withDb((db) => {
    const statement = db.prepare(`
      UPDATE expenses
      SET date = ?, description = ?, amount = ?
      WHERE id = ?
    `);

    statement.run([input.date, input.description.trim(), input.amount, id]);
    statement.free();
  }, true);
}

export async function deleteExpense(id: number) {
  return withDb((db) => {
    const statement = db.prepare("DELETE FROM expenses WHERE id = ?");
    statement.run([id]);
    statement.free();
  }, true);
}

export function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function validateExpenseInput(input: ExpenseInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return "日期不能为空，格式应为 YYYY-MM-DD";
  }

  if (!input.description.trim()) {
    return "用途不能为空";
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return "金额必须大于 0";
  }

  return null;
}

export function validateDateRange(startDate: string, endDate: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
  ) {
    return "开始日期和结束日期不能为空，格式应为 YYYY-MM-DD";
  }

  if (startDate > endDate) {
    return "开始日期不能晚于结束日期";
  }

  return null;
}
