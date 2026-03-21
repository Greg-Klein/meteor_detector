// app/page.tsx
// Page principale — server component léger qui délègue au Dashboard client

import Dashboard from "@/components/Dashboard";

export default function Home() {
  return <Dashboard />;
}
