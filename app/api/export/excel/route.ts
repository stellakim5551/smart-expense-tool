import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  listExpensesByDateRange,
  validateDateRange,
} from "@/lib/expenses-db";

export const runtime = "nodejs";

function getDateRangeFromUrl(request: Request) {
  const url = new URL(request.url);
  return {
    startDate: url.searchParams.get("startDate") ?? "",
    endDate: url.searchParams.get("endDate") ?? "",
  };
}

export async function GET(request: Request) {
  const { startDate, endDate } = getDateRangeFromUrl(request);
  const error = validateDateRange(startDate, endDate);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const expenses = await listExpensesByDateRange(startDate, endDate);
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const rows = [
    ["日期", "用途", "金额"],
    ...expenses.map((expense) => [
      expense.date,
      expense.description,
      expense.amount,
    ]),
    ["总计", "", total],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 14 },
    {
      wch: Math.max(
        12,
        ...expenses.map((expense) => expense.description.length + 4)
      ),
    },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "报销单");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  const filename = `报销单_${startDate}_${endDate}.xlsx`;
  const body = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
