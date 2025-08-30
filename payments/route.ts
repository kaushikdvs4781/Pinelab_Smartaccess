import { type NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/store"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const store = getStore()
  const p = store.payments.get(params.id)
  if (!p) return NextResponse.json({ code: "not_found", message: "Payment not found" }, { status: 404 })
  return NextResponse.json(p)
}
