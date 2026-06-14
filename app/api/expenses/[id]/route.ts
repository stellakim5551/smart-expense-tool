import { NextResponse } from "next/server";
import {
  deleteExpense,
  getCurrentMonth,
  getMonthlyTotal,
  listExpenses,
  updateExpense,
  validateExpenseInput,
  type ExpenseInput,
} from "@/lib/expenses-db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(id: string) {
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const expenseId = parseId(id);

  if (!expenseId) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  const body = (await request.json()) as ExpenseInput;
  const error = validateExpenseInput(body);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  await updateExpense(expenseId, body);
  const [expenses, monthlyTotal] = await Promise.all([
    listExpenses(),
    getMonthlyTotal(getCurrentMonth()),
  ]);

  return NextResponse.json({ expenses, monthlyTotal });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const expenseId = parseId(id);

  if (!expenseId) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  await deleteExpense(expenseId);
  const [expenses, monthlyTotal] = await Promise.all([
    listExpenses(),
    getMonthlyTotal(getCurrentMonth()),
  ]);

  return NextResponse.json({ expenses, monthlyTotal });
}
