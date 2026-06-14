import fs from "node:fs";
import { NextResponse } from "next/server";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import {
  listExpensesByDateRange,
  validateDateRange,
} from "@/lib/expenses-db";

export const runtime = "nodejs";

type TextMeasurer = {
  widthOfTextAtSize: (text: string, size: number) => number;
};

function getDateRangeFromUrl(request: Request) {
  const url = new URL(request.url);
  return {
    startDate: url.searchParams.get("startDate") ?? "",
    endDate: url.searchParams.get("endDate") ?? "",
  };
}

function findChineseFont() {
  const candidates = [
    "C:\\Windows\\Fonts\\simhei.ttf",
    "C:\\Windows\\Fonts\\Deng.ttf",
    "C:\\Windows\\Fonts\\hpsimplifiedhans-regular.ttf",
    "C:\\Windows\\Fonts\\STSONG.TTF",
  ];

  return candidates.find((fontPath) => fs.existsSync(fontPath));
}

function fitText(
  text: string,
  maxWidth: number,
  font: TextMeasurer,
  size: number
) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text;
  }

  let fitted = text;
  while (
    fitted.length > 0 &&
    font.widthOfTextAtSize(`${fitted}...`, size) > maxWidth
  ) {
    fitted = fitted.slice(0, -1);
  }

  return `${fitted}...`;
}

export async function GET(request: Request) {
  const { startDate, endDate } = getDateRangeFromUrl(request);
  const error = validateDateRange(startDate, endDate);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const expenses = await listExpensesByDateRange(startDate, endDate);
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fontPath = findChineseFont();
  if (!fontPath) {
    return NextResponse.json(
      { error: "未找到可用中文字体，无法生成中文 PDF" },
      { status: 500 }
    );
  }

  const fontBytes = fs.readFileSync(fontPath);
  const font = await pdf.embedFont(fontBytes);
  const page = pdf.addPage([595, 842]);
  const { height } = page.getSize();
  const marginX = 56;
  let y = height - 72;

  page.drawText("采购报销单", {
    x: marginX,
    y,
    size: 24,
    font,
    color: rgb(0.08, 0.11, 0.16),
  });

  y -= 34;
  page.drawText(`统计区间：${startDate} 至 ${endDate}`, {
    x: marginX,
    y,
    size: 12,
    font,
    color: rgb(0.25, 0.29, 0.35),
  });

  y -= 28;
  page.drawLine({
    start: { x: marginX, y },
    end: { x: 539, y },
    thickness: 1,
    color: rgb(0.82, 0.85, 0.88),
  });

  y -= 28;
  const dateX = marginX;
  const descriptionX = 176;
  const amountX = 440;

  page.drawText("日期", { x: dateX, y, size: 12, font });
  page.drawText("用途", { x: descriptionX, y, size: 12, font });
  page.drawText("金额", { x: amountX, y, size: 12, font });

  y -= 18;
  page.drawLine({
    start: { x: marginX, y },
    end: { x: 539, y },
    thickness: 0.7,
    color: rgb(0.9, 0.92, 0.94),
  });

  y -= 24;
  expenses.forEach((expense) => {
    page.drawText(expense.date, { x: dateX, y, size: 11, font });
    page.drawText(fitText(expense.description, 230, font, 11), {
      x: descriptionX,
      y,
      size: 11,
      font,
    });
    page.drawText(String(expense.amount), { x: amountX, y, size: 11, font });
    y -= 24;
  });

  if (expenses.length === 0) {
    page.drawText("该区间暂无记录", {
      x: marginX,
      y,
      size: 11,
      font,
      color: rgb(0.45, 0.49, 0.56),
    });
    y -= 24;
  }

  y -= 4;
  page.drawLine({
    start: { x: marginX, y },
    end: { x: 539, y },
    thickness: 1,
    color: rgb(0.82, 0.85, 0.88),
  });

  y -= 34;
  page.drawText(`总计：${total}元`, {
    x: marginX,
    y,
    size: 16,
    font,
    color: rgb(0.08, 0.11, 0.16),
  });

  page.drawText(`生成时间：${new Date().toISOString().slice(0, 10)}`, {
    x: marginX,
    y: 48,
    size: 9,
    font,
    color: rgb(0.55, 0.58, 0.64),
  });

  const bytes = await pdf.save();
  const filename = `报销单_${startDate}_${endDate}.pdf`;
  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
