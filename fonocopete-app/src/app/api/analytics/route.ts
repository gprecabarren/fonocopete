import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type AnalyticsDay = {
  total: number;
  hours: Record<string, number>;
};

type AnalyticsData = {
  days: Record<string, AnalyticsDay>;
};

const analyticsKey = "analytics";
let demoAnalytics: AnalyticsData = { days: {} };

function chileDateParts(date = new Date()) {
  const dateValue = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return { dateValue, hour };
}

function asAnalyticsData(value: unknown): AnalyticsData {
  if (!value || typeof value !== "object") return { days: {} };
  const days = (value as AnalyticsData).days;
  return days && typeof days === "object" ? { days } : { days: {} };
}

async function readAnalytics() {
  const supabase = createServerSupabaseClient();
  if (!supabase) return { data: demoAnalytics, supabase: null };

  const { data } = await supabase.from("site_settings").select("value").eq("key", analyticsKey).single();
  return { data: asAnalyticsData(data?.value), supabase };
}

function addVisit(data: AnalyticsData) {
  const { dateValue, hour } = chileDateParts();
  const day = data.days[dateValue] || { total: 0, hours: {} };
  day.total += 1;
  day.hours[hour] = (day.hours[hour] || 0) + 1;
  data.days[dateValue] = day;
  return data;
}

function parseLocalDate(value: string) {
  const parts = value.split("-").map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = parts[1] || 1;
  const day = parts[2] || 1;
  return new Date(year, month - 1, day);
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function periodKeys(range: "day" | "month" | "year", dateValue: string, offset = 0) {
  if (range === "day") {
    const date = parseLocalDate(dateValue);
    date.setDate(date.getDate() + offset);
    return [formatDateKey(date)];
  }
  if (range === "month") {
    const [yearValue, monthValue] = dateValue.split("-").map(Number);
    const base = new Date(yearValue, monthValue - 1 + offset, 1);
    return Array.from({ length: daysInMonth(base.getFullYear(), base.getMonth()) }, (_, index) =>
      formatDateKey(new Date(base.getFullYear(), base.getMonth(), index + 1)),
    );
  }
  const year = Number(dateValue.slice(0, 4)) + offset;
  return Array.from({ length: 12 }, (_, monthIndex) =>
    Array.from({ length: daysInMonth(year, monthIndex) }, (__, dayIndex) =>
      formatDateKey(new Date(year, monthIndex, dayIndex + 1)),
    ),
  ).flat();
}

function summarize(data: AnalyticsData, range: "day" | "month" | "year", dateValue: string) {
  const keys = periodKeys(range, dateValue);
  const previousKeys = periodKeys(range, dateValue, -1);
  const total = keys.reduce((sum, key) => sum + (data.days[key]?.total || 0), 0);
  const previousTotal = previousKeys.reduce((sum, key) => sum + (data.days[key]?.total || 0), 0);
  const hourTotals: Record<string, number> = {};
  keys.forEach((key) => {
    const day = data.days[key];
    if (!day) return;
    Object.entries(day.hours).forEach(([hour, count]) => {
      hourTotals[hour] = (hourTotals[hour] || 0) + count;
    });
  });
  const peakEntry = Object.entries(hourTotals).sort((a, b) => b[1] - a[1])[0];
  const buckets =
    range === "day"
      ? Array.from({ length: 24 }, (_, hour) => {
          const label = String(hour).padStart(2, "0");
          return { label: `${label}:00`, value: data.days[keys[0]]?.hours[label] || 0 };
        })
      : range === "month"
        ? keys.map((key) => ({ label: key.slice(8, 10), value: data.days[key]?.total || 0 }))
        : Array.from({ length: 12 }, (_, monthIndex) => {
            const label = String(monthIndex + 1).padStart(2, "0");
            const value = keys
              .filter((key) => key.slice(5, 7) === label)
              .reduce((sum, key) => sum + (data.days[key]?.total || 0), 0);
            return { label, value };
          });

  return {
    range,
    date: dateValue,
    total,
    previousTotal,
    peakHour: peakEntry ? `${peakEntry[0]}:00` : null,
    buckets,
  };
}

export async function POST() {
  const { data, supabase } = await readAnalytics();
  const nextData = addVisit(data);
  if (!supabase) {
    demoAnalytics = nextData;
    return NextResponse.json({ ok: true, source: "demo" });
  }
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: analyticsKey, value: nextData }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, source: "supabase" });
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const requestedRange = searchParams.get("range");
  const range: "day" | "month" | "year" =
    requestedRange === "month" || requestedRange === "year" ? requestedRange : "day";
  const { dateValue } = chileDateParts();
  const requestedDate = searchParams.get("date") || (range === "day" ? dateValue : range === "month" ? dateValue.slice(0, 7) : dateValue.slice(0, 4));
  const { data } = await readAnalytics();
  return NextResponse.json({ summary: summarize(data, range, requestedDate) });
}
