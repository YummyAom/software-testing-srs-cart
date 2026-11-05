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
// OP-3: addItem(productId, quantity) - POST /cart/items
// =============================================================================

describe("OP-3 addItem - Happy Path", () => {
    it("OP3-A1 (FR-2.3.1) add new product to empty cart", async () => {
        const res = await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 2 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        const p1 = body.data.lines.find((l: any) => l.productId === "P1")
        expect(p1.quantity).toBe(2)
        expect(body.data.lineCount).toBe(1)
    })

    it("OP3-A2 (FR-2.3.2) add quantity to existing line", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 2 }),
        })

        const res = await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 3 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        const p1 = body.data.lines.find((l: any) => l.productId === "P1")
        expect(p1.quantity).toBe(5)
        expect(body.data.lineCount).toBe(1)
    })
})

describe("OP-3 addItem - Negative", () => {
    it("OP3-B0 (FR-0.2) missing token returns 401 AUTH_REQUIRED", async () => {
        const res = await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: JSON_HDR,
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        expect(res.status).toBe(401)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_REQUIRED")
    })

    it("OP3-B1 (FR-2.1.2, AC-1) quantity out of range returns 400 QTY_OUT_OF_RANGE", async () => {
        const res = await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 0 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("QTY_OUT_OF_RANGE")
    })

    it("OP3-B2 (FR-2.2.1) unknown product returns 404 PRODUCT_NOT_FOUND", async () => {
        const res = await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P999", quantity: 1 }),
        })

        expect(res.status).toBe(404)
        const body: any = await res.json()
        expect(body.error.code).toBe("PRODUCT_NOT_FOUND")
    })

    it("OP3-B3 (FR-2.2.2, AC-11c) unavailable product returns 400 PRODUCT_UNAVAILABLE", async () => {
        // reserve all P2 stock: availableStock becomes 0
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 3 }),
        })
        const checkoutRes = await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })
        expect(checkoutRes.status).toBe(201)

        const res = await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...PRIME, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("PRODUCT_UNAVAILABLE")
    })

    it("OP3-B4 (FR-2.4.1, AC-2) total quantity > 10 returns 400 QTY_OUT_OF_RANGE", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 8 }),
        })

        const res = await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 3 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("QTY_OUT_OF_RANGE")
    })

    it("OP3-B5 (FR-2.4.2, AC-3) total quantity exceeds available stock returns 400 INSUFFICIENT_STOCK", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 2 }),
        })

        const res = await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 2 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("INSUFFICIENT_STOCK")
    })

    it("OP3-B6 (FR-8.1, AC-17) addItem in checkout stage returns 400 OPERATION_NOT_ALLOWED", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })
        const checkoutRes = await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })
        expect(checkoutRes.status).toBe(201)

        const res = await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("OPERATION_NOT_ALLOWED")
    })

    it("OP3-B7 (FR-0.3.1) admin cannot call addItem", async () => {
        const res = await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        expect(res.status).toBe(403)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_FORBIDDEN")
    })
})
