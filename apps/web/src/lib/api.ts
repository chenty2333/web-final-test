import { cookies } from "next/headers";
import { demoCategories, demoDashboard } from "@/lib/demo-data";
import type { Category, DashboardData } from "@/types";

type ApiPayload<T> = {
  code: number;
  msg: string;
  data: T;
};

export function apiBase() {
  return process.env.API_BASE_URL || "http://127.0.0.1:8787";
}

export async function fetchBackend<T>(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${apiBase()}/api${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload<T>;
  if (!response.ok || payload.code !== 0) throw new Error(payload.msg || "请求失败");
  return payload.data;
}

export async function getDashboard(month?: string): Promise<{ data: DashboardData; demo: boolean }> {
  try {
    const query = month ? `?month=${encodeURIComponent(month)}` : "";
    return { data: await fetchBackend<DashboardData>(`/dashboard${query}`), demo: false };
  } catch {
    return { data: demoDashboard, demo: true };
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const data = await fetchBackend<{ categories: Category[] }>("/categories");
    return data.categories;
  } catch {
    return demoCategories;
  }
}
