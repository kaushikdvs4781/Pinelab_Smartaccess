"use client"

import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function DashboardPage() {
  const { data } = useSWR("/api/mock/payments", fetcher, { refreshInterval: 5000 })
  const list = data?.data || []
  const count = list.length
  const succ = list.filter((p: any) => p.status === "succeeded").length
  const hasWebhook = data?.webhookStats?.lastDeliveryAt ? 1 : 0
  const hasIdem = data?.stats?.idempotencyCoverage || 0
  const readiness = Math.min(100, Math.round((succ > 0 ? 50 : 0) + hasWebhook * 25 + hasIdem * 25))

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Integration Health Dashboard</h1>
        <p className="text-muted-foreground">Track mock runs, webhooks, and go-live readiness</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Mock Payments</CardTitle>
            <CardDescription>All runs in this preview session</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{count}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Succeeded</CardTitle>
            <CardDescription>Successful transactions</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{succ}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Readiness Score</CardTitle>
            <CardDescription>Higher = closer to go-live</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{readiness}%</CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent Runs</CardTitle>
            <CardDescription>Latest mock payments</CardDescription>
          </CardHeader>
        </Card>
        <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs mt-4">
          {JSON.stringify(data || {}, null, 2)}
        </pre>
      </section>
    </main>
  )
}
