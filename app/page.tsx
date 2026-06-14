"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Expense = {
  id: number;
  date: string;
  description: string;
  amount: number;
  created_at: string;
};

type ExpenseForm = {
  date: string;
  description: string;
  amount: string;
};

type ExportRange = {
  startDate: string;
  endDate: string;
};

type QuickRange = "today" | "last3" | "last7" | "month" | "custom";

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function today() {
  return formatDate(new Date());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function currentMonth() {
  return today().slice(0, 7);
}

function monthRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    startDate: formatDate(firstDay),
    endDate: formatDate(lastDay),
  };
}

function rangeFor(type: QuickRange): ExportRange {
  const now = new Date();

  if (type === "today") {
    return { startDate: formatDate(now), endDate: formatDate(now) };
  }

  if (type === "last3") {
    return { startDate: formatDate(addDays(now, -2)), endDate: formatDate(now) };
  }

  if (type === "last7") {
    return { startDate: formatDate(addDays(now, -6)), endDate: formatDate(now) };
  }

  return monthRange();
}

function money(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(value);
}

const emptyForm = (): ExpenseForm => ({
  date: today(),
  description: "",
  amount: "",
});

const quickRanges: Array<{ key: QuickRange; label: string }> = [
  { key: "today", label: "今天" },
  { key: "last3", label: "最近3天" },
  { key: "last7", label: "最近7天" },
  { key: "month", label: "本月" },
  { key: "custom", label: "自定义" },
];

export default function HomePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [exportRange, setExportRange] = useState<ExportRange>(rangeFor("today"));
  const [activeRange, setActiveRange] = useState<QuickRange>("today");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const recentExpenses = useMemo(() => expenses.slice(0, 5), [expenses]);

  async function loadExpenses() {
    setLoading(true);
    const response = await fetch("/api/expenses", { cache: "no-store" });
    const data = await response.json();
    setExpenses(data.expenses ?? []);
    setMonthlyTotal(data.monthlyTotal ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    loadExpenses().catch(() => {
      setMessage("记录加载失败，请刷新页面重试。");
      setLoading(false);
    });
  }, []);

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  function editExpense(expense: Expense) {
    setEditingId(expense.id);
    setForm({
      date: expense.date,
      description: expense.description,
      amount: String(expense.amount),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseQuickRange(type: QuickRange) {
    setActiveRange(type);

    if (type !== "custom") {
      setExportRange(rangeFor(type));
    }
  }

  function updateExportRange(value: Partial<ExportRange>) {
    setActiveRange("custom");
    setExportRange((current) => ({ ...current, ...value }));
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSaving(true);

    const payload = {
      date: form.date,
      description: form.description.trim(),
      amount: Number(form.amount),
    };

    const response = await fetch(
      editingId ? `/api/expenses/${editingId}` : "/api/expenses",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(data.error ?? "保存失败，请检查输入内容。");
      return;
    }

    setExpenses(data.expenses ?? []);
    setMonthlyTotal(data.monthlyTotal ?? 0);
    setMessage(editingId ? "记录已更新。" : "记录已保存。");
    resetForm();
  }

  async function removeExpense(expense: Expense) {
    if (!window.confirm(`确认删除「${expense.description}」吗？`)) {
      return;
    }

    const response = await fetch(`/api/expenses/${expense.id}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "删除失败，请稍后重试。");
      return;
    }

    setExpenses(data.expenses ?? []);
    setMonthlyTotal(data.monthlyTotal ?? 0);
    setMessage("记录已删除。");

    if (editingId === expense.id) {
      resetForm();
    }
  }

  function exportFile(type: "excel" | "pdf") {
    if (!exportRange.startDate || !exportRange.endDate) {
      setMessage("请先选择开始日期和结束日期。");
      return;
    }

    if (exportRange.startDate > exportRange.endDate) {
      setMessage("开始日期不能晚于结束日期。");
      return;
    }

    const path = type === "excel" ? "/api/export/excel" : "/api/export/pdf";
    const params = new URLSearchParams(exportRange);
    window.location.href = `${path}?${params.toString()}`;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-5 sm:px-6">
        <header className="mb-5">
          <p className="text-sm font-medium text-emerald-700">智能报销助手 V1.1</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">采购报销记录</h1>
              <p className="mt-1 text-sm text-slate-500">本月 {currentMonth()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">本月总支出</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">
                {money(monthlyTotal)}
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">
              {editingId ? "编辑记录" : "新增记录"}
            </h2>
            {editingId ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                <X />
                取消
              </Button>
            ) : (
              <Plus className="size-5 text-emerald-700" />
            )}
          </div>

          <form className="grid gap-3" onSubmit={submitExpense}>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-slate-700">日期</span>
              <Input
                required
                type="date"
                value={form.date}
                className="h-11"
                onChange={(event) =>
                  setForm((value) => ({ ...value, date: event.target.value }))
                }
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-slate-700">用途</span>
              <Input
                required
                value={form.description}
                placeholder="例如：购买包装袋"
                className="h-11"
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    description: event.target.value,
                  }))
                }
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-slate-700">金额</span>
              <Input
                required
                min="0.01"
                step="0.01"
                type="number"
                inputMode="decimal"
                value={form.amount}
                placeholder="例如：120"
                className="h-11"
                onChange={(event) =>
                  setForm((value) => ({ ...value, amount: event.target.value }))
                }
              />
            </label>

            {message ? (
              <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
                {message}
              </p>
            ) : null}

            <Button className="mt-1 h-11 bg-emerald-700 text-white hover:bg-emerald-800">
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {editingId ? "保存修改" : "保存记录"}
            </Button>
          </form>
        </section>

        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="size-5 text-emerald-700" />
            <h2 className="text-base font-semibold">导出报销单</h2>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {quickRanges.map((range) => (
              <Button
                key={range.key}
                type="button"
                variant={activeRange === range.key ? "default" : "outline"}
                className={
                  activeRange === range.key
                    ? "h-9 bg-emerald-700 text-white hover:bg-emerald-800"
                    : "h-9 bg-white"
                }
                onClick={() => chooseQuickRange(range.key)}
              >
                {range.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-slate-700">开始日期</span>
              <Input
                required
                type="date"
                value={exportRange.startDate}
                className="h-11"
                onChange={(event) =>
                  updateExportRange({ startDate: event.target.value })
                }
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-slate-700">结束日期</span>
              <Input
                required
                type="date"
                value={exportRange.endDate}
                className="h-11"
                onChange={(event) =>
                  updateExportRange({ endDate: event.target.value })
                }
              />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 bg-white"
              onClick={() => exportFile("excel")}
            >
              <FileSpreadsheet />
              导出Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 bg-white"
              onClick={() => exportFile("pdf")}
            >
              <FileText />
              导出PDF
            </Button>
          </div>
        </section>

        <section className="mt-6 flex-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">历史记录</h2>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Download className="size-3.5" />
              {expenses.length} 条
            </div>
          </div>

          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
              正在加载记录...
            </div>
          ) : expenses.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-center text-sm text-slate-500">
              暂无记录，保存第一笔支出后会显示在这里。
            </div>
          ) : (
            <div className="grid gap-3 pb-8">
              {recentExpenses.map((expense) => (
                <article
                  key={expense.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-500">{expense.date}</p>
                      <h3 className="mt-1 truncate text-base font-medium">
                        {expense.description}
                      </h3>
                    </div>
                    <p className="shrink-0 text-lg font-semibold text-slate-950">
                      {money(expense.amount)}
                    </p>
                  </div>

                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => editExpense(expense)}
                    >
                      <Pencil />
                      编辑
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeExpense(expense)}
                    >
                      <Trash2 />
                      删除
                    </Button>
                  </div>
                </article>
              ))}

              {expenses.length > recentExpenses.length ? (
                <details className="rounded-lg border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">
                    查看全部记录
                  </summary>
                  <div className="mt-3 grid gap-3">
                    {expenses.slice(5).map((expense) => (
                      <article
                        key={expense.id}
                        className="border-t border-slate-100 pt-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-slate-500">{expense.date}</p>
                            <h3 className="mt-1 truncate text-base font-medium">
                              {expense.description}
                            </h3>
                          </div>
                          <p className="shrink-0 font-semibold">
                            {money(expense.amount)}
                          </p>
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => editExpense(expense)}
                          >
                            <Pencil />
                            编辑
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeExpense(expense)}
                          >
                            <Trash2 />
                            删除
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
