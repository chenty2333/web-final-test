import { getCategories, getDashboard } from "@/lib/api";
import { DashboardClient } from "@/components/dashboard-client";

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const [{ data, demo }, categories] = await Promise.all([getDashboard(params.month), getCategories()]);
  return <DashboardClient initialDashboard={data} categories={categories} demoMode={demo} />;
}
