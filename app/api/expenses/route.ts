import { NextResponse } from "next/server";
import {
  createExpense,
  getCurrentMonth,
  getMonthlyTotal,
  listExpenses,
  validateExpenseInput,
  type ExpenseInput,
} from "@/lib/expenses-db";

export const runtime = "nodejs";

export async function GET() {
  const month = getCurrentMonth();
  const [expenses, monthlyTotal] = await Promise.all([
    listExpenses(),
    getMonthlyTotal(month),
  ]);

  return NextResponse.json({ expenses, monthlyTotal, month });
}

export async function POST(request: Request) {
  const body = (await request.json()) as ExpenseInput;
  const error = validateExpenseInput(body);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  await createExpense(body);
  const expenses = await listExpenses();
  const monthlyTotal = await getMonthlyTotal(getCurrentMonth());

  return NextResponse.json({ expenses, monthlyTotal }, { status: 201 });
}
