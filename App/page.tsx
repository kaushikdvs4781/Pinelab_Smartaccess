"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { cn } from "@/lib/utils"

type ApiResponse = {
  ok: boolean
  status: number
  data?: any
  error?: { code: string; message: string }
}

const DEFAULT_SECRET = "whsec_test_123"
const DEFAULT_CURRENCY = "INR"

function randomId(len = 24) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let out = ""
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function useIdempotencyKey() {
  const [key, setKey] = useState("")
  useEffect(() => {
    setKey(`idem_${randomId(16)}`)
  }, [])
  return [key, () => setKey(`idem_${randomId(16)}`)] as const
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="mt-2 w-full overflow-auto rounded-md bg-muted p-3 text-xs leading-6">
      <code>{code}</code>
    </pre>
  )
}

function ResponseViewer({ res }: { res?: ApiResponse }) {
  if (!res) return null
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Response</CardTitle>
        <CardDescription>{res.ok ? `HTTP ${res.status}` : `Error (HTTP ${res.status})`}</CardDescription>
      </CardHeader>
      <CardContent>
        <CodeBlock code={JSON.stringify(res.ok ? res.data : res.error, null, 2)} />
      </CardContent>
    </Card>
  )
}

function PaymentForm() {
  const [amount, setAmount] = useState<string>("1000") // minor units
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY)
  const [idemKey, regenKey] = useIdempotencyKey()
  const [simulate, setSimulate] = useState<"none" | "timeout" | "requires_action" | "duplicate">("none")
  const [resp, setResp] = useState<ApiResponse>()
  const [loading, setLoading] = useState(false)

  const payload = useMemo(
    () => ({
      amount: Number(amount || "0"),
      currency,
      simulate: simulate !== "none" ? simulate : undefined,
      metadata: { order_id: `ord_${randomId(8)}` },
    }),
    [amount, currency, simulate],
  )

  const curl = useMemo(() => {
    const body = JSON.stringify(payload).replace(/"/g, '\\"')
    return [
      "curl -X POST https://your-preview-url.vercel.app/api/mock/payments",
      `  -H "Content-Type: application/json"`,
      `  -H "Idempotency-Key: ${idemKey}"`,
      `  -d "${body}"`,
    ].join(" \\\n")
  }, [payload, idemKey])

  const nodeFetch = useMemo(() => {
    return `import fetch from "node-fetch";

const res = await fetch("/api/mock/payments", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": "${idemKey}",
  },
  body: JSON.stringify(${JSON.stringify(payload, null, 2)}),
});

const json = await res.json();
console.log(json);`
  }, [payload, idemKey])

  async function submit() {
    setLoading(true)
    setResp(undefined)
    try {
      const res = await fetch("/api/mock/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idemKey,
        },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      setResp({ ok: res.ok, status: res.status, data: res.ok ? json : undefined, error: res.ok ? undefined : json })
    } catch (e: any) {
      setResp({
        ok: false,
        status: 0,
        error: { code: "network_error", message: e?.message || "Network error" },
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-pretty">Create Payment (Mock)</CardTitle>
        <CardDescription>Validated request builder with idempotency and failure simulation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (minor units)</Label>
            <Input
              id="amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1000 for ₹10.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="idempotency">Idempotency-Key</Label>
            <div className="flex items-center gap-2">
              <Input id="idempotency" value={idemKey} readOnly />
              <Button type="button" variant="secondary" onClick={regenKey}>
                Regenerate
              </Button>
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="simulate">Simulate</Label>
            <div className="flex flex-wrap gap-2">
              {(["none", "requires_action", "timeout", "duplicate"] as const).map((opt) => (
                <Button
                  key={opt}
                  type="button"
                  variant={simulate === opt ? "default" : "outline"}
                  onClick={() => setSimulate(opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button disabled={loading} onClick={submit}>
            {loading ? "Creating…" : "Create Payment"}
          </Button>
          <Link href="/dashboard" className={cn("text-sm underline self-center")}>
            View Dashboard
          </Link>
        </div>

        <Tabs defaultValue="curl" className="mt-4">
          <TabsList>
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="node">Node</TabsTrigger>
          </TabsList>
          <TabsContent value="curl">
            <CodeBlock code={curl} />
          </TabsContent>
          <TabsContent value="node">
            <CodeBlock code={nodeFetch} />
          </TabsContent>
        </Tabs>

        <ResponseViewer res={resp} />
      </CardContent>
    </Card>
  )
}

function WebhookLab() {
  const [url, setUrl] = useState<string>("")
  const [event, setEvent] = useState<string>("payment.succeeded")
  const [result, setResult] = useState<ApiResponse>()
  const [loading, setLoading] = useState(false)

  const verifySnippet = `import crypto from "crypto"

export function verify(body, signatureHeader, secret = "${DEFAULT_SECRET}") {
  const [tPart, v1Part] = signatureHeader.split(",")
  const t = tPart.split("=")[1]
  const provided = v1Part.split("=")[1]
  const payload = \`\${t}.\${JSON.stringify(body)}\`
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex")
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(provided))
}`

  async function trigger() {
    setLoading(true)
    setResult(undefined)
    try {
      const res = await fetch("/api/mock/webhooks/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, eventType: event }),
      })
      const json = await res.json()
      setResult({ ok: res.ok, status: res.status, data: res.ok ? json : undefined, error: res.ok ? undefined : json })
    } catch (e: any) {
      setResult({ ok: false, status: 0, error: { code: "network_error", message: e?.message || "Network error" } })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-pretty">Webhook Lab</CardTitle>
        <CardDescription>Send signed test events to your local/public URL</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Webhook URL</Label>
          <Input
            placeholder="https://example.com/webhooks/pine-labs"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Tip: Use a tunnel like Cloudflare Tunnel/Ngrok when testing locally.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["payment.succeeded", "payment.failed", "payment.requires_action"].map((name) => (
            <Button
              key={name}
              type="button"
              variant={event === name ? "default" : "outline"}
              onClick={() => setEvent(name)}
            >
              {name}
            </Button>
          ))}
        </div>
        <div className="flex gap-3">
          <Button disabled={!url || loading} onClick={trigger}>
            {loading ? "Sending…" : "Send Test Webhook"}
          </Button>
          <div className="self-center text-sm text-muted-foreground">
            Secret: <span className="font-mono">{DEFAULT_SECRET}</span> • Header:{" "}
            <span className="font-mono">X-PL-Signature</span>
          </div>
        </div>

        <div>
          <Label>Node signature verification</Label>
          <CodeBlock code={verifySnippet} />
        </div>

        <ResponseViewer res={result} />
      </CardContent>
    </Card>
  )
}

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-balance text-2xl font-semibold md:text-3xl">Pine Labs Quickstart Studio (Mock)</h1>
        <p className="text-muted-foreground">
          Self-explanatory, fast, resilient playground to integrate Pine Labs Online payment APIs without portal access.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <PaymentForm />
        <WebhookLab />
      </div>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>What’s included</CardTitle>
            <CardDescription>Mock API, signed webhooks, idempotency, dashboard and CLI</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            - POST /api/mock/payments (idempotent) • GET /api/mock/payments/:id • Webhook trigger with HMAC-SHA256
            signature
            <br />- Dashboard:{" "}
            <Link className="underline" href="/dashboard">
              /dashboard
            </Link>{" "}
            • CLI skeleton under /scripts/plol.mjs
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
