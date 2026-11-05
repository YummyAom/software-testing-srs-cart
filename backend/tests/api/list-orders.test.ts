import { describe, it, expect, beforeAll, beforeEach } from "vitest"

const PORT = process.env.API_PORT ?? 3001
const baseURL = `http://localhost:${PORT}`
const JSON_HDR = { "Content-Type": "application/json" }

let NORMAL: Record<string, string>
let PRIME: Record<string, string>
let ADMIN: Record<string, string>

async function loginAs(username: string, password: string | undefined) {
    const res = await fetch(`${baseURL}/auth/login`, {
        method: "POST",
        headers: JSON_HDR,
        body: JSON.stringify({ username, password }),
    })
    const body: any = await res.json()
    if (!res.ok || !body?.data?.accessToken) {
        throw new Error(`login as ${username} failed: ${res.status} ${JSON.stringify(body)}`)
    }
    return { Authorization: `Bearer ${body.data.accessToken}` }
}

async function createPendingOrder(headers: Record<string, string>, productId: string, quantity: number) {
    const addRes = await fetch(`${baseURL}/cart/items`, {
        method: "POST",
        headers: { ...headers, ...JSON_HDR },
        body: JSON.stringify({ productId, quantity }),
    })
    expect(addRes.status).toBe(200)

    const checkoutRes = await fetch(`${baseURL}/cart/checkout`, {
        method: "POST",
        headers: { ...headers, ...JSON_HDR },
        body: JSON.stringify({ zone: "inCity", speed: "standard" }),
    })
    expect(checkoutRes.status).toBe(201)

    const checkoutBody: any = await checkoutRes.json()
    return checkoutBody.data.order.orderId as string
}

// login once per file: logging in for every test hits the Supabase Auth rate limit.
// /test/reset keeps app_users, so these tokens stay valid across resets.
beforeAll(async () => {
    NORMAL = await loginAs("cus_normal", process.env.SEED_PASSWORD_CUSTOMER_NORMAL)
    PRIME = await loginAs("cus_prime", process.env.SEED_PASSWORD_CUSTOMER_PRIME)
    ADMIN = await loginAs("admin01", process.env.SEED_PASSWORD_ADMIN)
})

beforeEach(async () => {
    // only the APP_ENV=test server has /test/reset, so a 404 here means the API is on the shared DB: stop before writing anything
    const reset = await fetch(`${baseURL}/test/reset`, {
        method: "POST",
        headers: { "x-test-reset-token": process.env.TEST_RESET_TOKEN ?? "" },
    })
    expect(reset.status).toBe(200)
})

// =============================================================================
// OP-13: listOrders() - GET /orders
// =============================================================================

describe("OP-13 listOrders", () => {
    it("OP13-A1 (FR-0.5.1) customer sees only their own orders", async () => {
        const normalOrderId = await createPendingOrder(NORMAL, "P1", 1)
        const primeOrderId = await createPendingOrder(PRIME, "P1", 1)

        const res = await fetch(`${baseURL}/orders`, { headers: NORMAL })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        const ids = body.data.orders.map((o: any) => o.orderId)
        expect(ids).toContain(normalOrderId)
        expect(ids).not.toContain(primeOrderId)
    })

    it("OP13-A2 (FR-0.6) orders are sorted newest to oldest", async () => {
        // create first order
        const firstOrderId = await createPendingOrder(NORMAL, "P1", 1)

        // complete first order and return to cart so the same customer can create next order
        const payRes = await fetch(`${baseURL}/orders/${firstOrderId}/pay-success`, {
            method: "POST",
            headers: JSON_HDR,
            body: JSON.stringify({ result: "success" }),
        })
        expect(payRes.status).toBe(200)

        const continueRes = await fetch(`${baseURL}/cart/continue`, {
            method: "POST",
            headers: NORMAL,
        })
        expect(continueRes.status).toBe(200)

        // create second (newer) order
        const secondOrderId = await createPendingOrder(NORMAL, "P2", 1)

        const res = await fetch(`${baseURL}/orders`, { headers: NORMAL })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        const orders: any[] = body.data.orders
        expect(orders.length).toBeGreaterThanOrEqual(2)

        // Check explicit ordering by createdAt desc
        for (let i = 0; i < orders.length - 1; i++) {
            const left = Date.parse(orders[i].createdAt)
            const right = Date.parse(orders[i + 1].createdAt)
            expect(left).toBeGreaterThanOrEqual(right)
        }

        // The newer order should appear before the older one.
        const ids = orders.map((o) => o.orderId)
        expect(ids.indexOf(secondOrderId)).toBeLessThan(ids.indexOf(firstOrderId))
    })

    it("OP13-A3 (FR-0.5.1) customer with no orders gets empty list", async () => {
        const res = await fetch(`${baseURL}/orders`, { headers: NORMAL })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.orders).toEqual([])
    })

    it("OP13-B1 (FR-0.2) missing token returns 401 AUTH_REQUIRED", async () => {
        const res = await fetch(`${baseURL}/orders`)

        expect(res.status).toBe(401)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_REQUIRED")
    })

    it("OP13-B2 (FR-0.3.1) admin cannot list customer orders", async () => {
        const res = await fetch(`${baseURL}/orders`, { headers: ADMIN })

        expect(res.status).toBe(403)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_FORBIDDEN")
    })
})
