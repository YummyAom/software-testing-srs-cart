import { describe, it, expect, beforeEach } from "vitest"

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
    return { Authorization: `Bearer ${body.data.accessToken}` }
}

beforeEach(async () => {
    // only the APP_ENV=test server has /test/reset, so a 404 here means the API is on the shared DB: stop before writing anything
    const reset = await fetch(`${baseURL}/test/reset`, {
        method: "POST",
        headers: { "x-test-reset-token": process.env.TEST_RESET_TOKEN ?? "" },
    })
    expect(reset.status).toBe(200)

    NORMAL = await loginAs("cus_normal", process.env.SEED_PASSWORD_CUSTOMER_NORMAL)
    PRIME = await loginAs("cus_prime", process.env.SEED_PASSWORD_CUSTOMER_PRIME)
    ADMIN = await loginAs("admin01", process.env.SEED_PASSWORD_ADMIN)
})

// =============================================================================
// OP-7: viewCart() - GET /cart
// =============================================================================

describe("OP-7 viewCart - Happy Path", () => {
    it("OP7-A1 (FR-1.1) initial empty cart state", async () => {
        const res = await fetch(`${baseURL}/cart`, {
            headers: NORMAL,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.stage).toBe("cart")
        expect(body.data.lineCount).toBe(0)
        expect(body.data.lines).toEqual([])
        expect(body.data.couponCode).toBe(null)
        expect(body.data.checkoutEnabled).toBe(false)
        expect(body.data.subtotal).toBe(0)
    })

    it("OP7-A2 (FR-2.9, FR-4.1) displays item details, subtotal and bound coupon", async () => {
        // Add P1 x 2 (450 * 2 = 900)
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 2 }),
        })
        // Add P2 x 1 (1200 * 1 = 1200)
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })
        // Bind SAVE10
        await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })

        const res = await fetch(`${baseURL}/cart`, {
            headers: NORMAL,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.lineCount).toBe(2)
        expect(body.data.subtotal).toBe(2100)
        expect(body.data.couponCode).toBe("SAVE10")
        expect(body.data.checkoutEnabled).toBe(true)

        const p1 = body.data.lines.find((l: any) => l.productId === "P1")
        expect(p1.unitPrice).toBe(450)
        expect(p1.quantity).toBe(2)
        expect(p1.available).toBe(true)
    })

    it("OP7-A3 (FR-2.9, FR-4.1, FR-9.2.1) reflects updated price live after Admin changes price", async () => {
        // Add P1 x 2 (450 * 2 = 900)
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 2 }),
        })

        // Admin updates P1 price to 500
        await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 500 }),
        })

        // Customer views cart -> unitPrice should be 500, subtotal 1000
        const res = await fetch(`${baseURL}/cart`, {
            headers: NORMAL,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        const p1 = body.data.lines.find((l: any) => l.productId === "P1")
        expect(p1.unitPrice).toBe(500)
        expect(body.data.subtotal).toBe(1000)
    })

    it("OP7-A4 (FR-2.9, FR-9.3.4) offSale product remains in cart with available=false", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        // Admin turns P1 offSale
        await fetch(`${baseURL}/admin/products/P1/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "offSale" }),
        })

        const res = await fetch(`${baseURL}/cart`, {
            headers: NORMAL,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        const p1 = body.data.lines.find((l: any) => l.productId === "P1")
        expect(p1).toBeDefined()
        expect(p1.available).toBe(false)
    })

    it("OP7-A5 (FR-8.5.2, FR-5.3.9) cart readable in stage checkout without changing state", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 2 }),
        })
        await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })

        // View cart while in stage checkout
        const res = await fetch(`${baseURL}/cart`, {
            headers: NORMAL,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.stage).toBe("checkout")
        expect(body.data.lineCount).toBe(1)
        expect(body.data.checkoutEnabled).toBe(false) // disabled in checkout stage
    })

    it("OP7-A6 (FR-1.2.1, FR-1.2.2) cart items and bound coupon persist across re-login", async () => {
        // Normal user adds item and binds coupon
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 2 }),
        })
        await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })

        // Re-login to get a new token
        const newNormal = await loginAs("cus_normal", process.env.SEED_PASSWORD_CUSTOMER_NORMAL)

        // View cart with new token
        const res = await fetch(`${baseURL}/cart`, {
            headers: newNormal,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.lineCount).toBe(1)
        expect(body.data.lines[0].productId).toBe("P1")
        expect(body.data.lines[0].quantity).toBe(2)
        expect(body.data.couponCode).toBe("SAVE10")
    })

    it("OP7-A7 (FR-0.4) cart isolation between customers", async () => {
        // cus_normal has P1 x 2
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 2 }),
        })

        // cus_prime views cart -> should be empty
        const primeRes = await fetch(`${baseURL}/cart`, {
            headers: PRIME,
        })

        expect(primeRes.status).toBe(200)
        const primeBody: any = await primeRes.json()
        expect(primeBody.data.lineCount).toBe(0)
        expect(primeBody.data.lines).toEqual([])
    })
})

describe("OP-7 viewCart - Negative", () => {
    it("OP7-B1 (FR-0.2) missing authorization header returns 401 AUTH_REQUIRED", async () => {
        const res = await fetch(`${baseURL}/cart`)

        expect(res.status).toBe(401)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_REQUIRED")
    })

    it("OP7-B2 (FR-0.3.1) Admin token returns 403 AUTH_FORBIDDEN", async () => {
        const res = await fetch(`${baseURL}/cart`, {
            headers: ADMIN,
        })

        expect(res.status).toBe(403)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_FORBIDDEN")
    })
})

describe("OP-7 viewCart - Boundary", () => {
    it("OP7-C1 (FR-2.8) checkoutEnabled = true when lineCount >= 1 and stage is cart", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        const res = await fetch(`${baseURL}/cart`, {
            headers: NORMAL,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.lineCount).toBe(1)
        expect(body.data.checkoutEnabled).toBe(true)
    })

    it("OP7-C2 (FR-2.8) checkoutEnabled = false when stage is checkout even with items", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })
        await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })

        const res = await fetch(`${baseURL}/cart`, {
            headers: NORMAL,
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.stage).toBe("checkout")
        expect(body.data.lineCount).toBe(1)
        expect(body.data.checkoutEnabled).toBe(false)
    })
})

