import { type NextRequest, NextResponse } from "next/server"
import { signPayload } from "@/lib/signing"
import { getStore } from "@/lib/store"

export async function POST(req: NextRequest) {
  const { url, eventType = "payment.succeeded", paymentId } = await req.json().catch(() => ({}))
  if (!url || typeof url !== "string") {
    return NextResponse.json({ code: "invalid_url", message: "Provide a valid URL" }, { status: 400 })
  }

  const store = getStore()
  const base = {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    type: eventType,
    created_at: new Date().toISOString(),
  }

  const payment = (paymentId && store.payments.get(paymentId)) || {
    id: `pay_${Math.random().toString(36).slice(2)}`,
    amount: 1000,
    currency: "INR",
    status:
      eventType === "payment.failed"
        ? "failed"
        : eventType === "payment.requires_action"
          ? "requires_action"
          : "succeeded",
    created_at: new Date().toISOString(),
    metadata: null,
  }

  const body = { ...base, data: { object: payment } }
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = signPayload(body, timestamp) // hex
  const header = `t=${timestamp},v1=${signature}`

  let delivered = false
  let error: any = null
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PL-Signature": header },
      body: JSON.stringify(body),
    })
    delivered = res.ok
    if (!res.ok) error = { status: res.status, statusText: res.statusText }
  } catch (e: any) {
    error = { message: e?.message || "Network error" }
  }

  store.webhookStats.lastDeliveryAt = new Date().toISOString()
  store.webhookStats.lastStatus = delivered ? "ok" : "failed"

  if (!delivered) return NextResponse.json({ delivered, error }, { status: 502 })
  return NextResponse.json({ delivered, event: body })
}
