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
// OP-4: updateQuantity(productId, quantity) - PUT /cart/items/:productId
// =============================================================================

describe("OP-4 updateQuantity - Happy Path", () => {
    it("OP4-A1 (FR-2.5.6) update quantity replaces previous value", async () => {
        // Precondition -> cus_normal has P1 x 3 in cart
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 3 }),
        })

        // Act -> update to 7
        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 7 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        const p1 = body.data.lines.find((l: any) => l.productId === "P1")
        expect(p1.quantity).toBe(7)
        expect(body.data.subtotal).toBe(3150)
        expect(body.data.lineCount).toBe(1)
    })

    it("OP4-A2 (FR-2.5.6) decrease quantity replaces previous value", async () => {
        // Precondition -> cus_normal has P1 x 3 in cart
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 3 }),
        })

        // Act -> decrease to 2
        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 2 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        const p1 = body.data.lines.find((l: any) => l.productId === "P1")
        expect(p1.quantity).toBe(2)
        expect(body.data.subtotal).toBe(900)
    })

    it("OP4-A3 (FR-2.5.6) updating one item does not affect other items", async () => {
        // Precondition -> P1 x 1, P2 x 1 in cart
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })

        // Act -> update P1 to 5
        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 5 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        const p1 = body.data.lines.find((l: any) => l.productId === "P1")
        const p2 = body.data.lines.find((l: any) => l.productId === "P2")
        expect(p1.quantity).toBe(5)
        expect(p2.quantity).toBe(1)
        expect(body.data.lineCount).toBe(2)
    })

    it("OP4-A4 (FR-0.4) update quantity by customer A does not affect customer B", async () => {
        // cus_normal has P1 x 2
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 2 }),
        })
        // cus_prime has P1 x 1
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...PRIME, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        // cus_normal updates to 6
        await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 6 }),
        })

        // check cus_prime cart remains 1
        const primeCartRes = await fetch(`${baseURL}/cart`, { headers: PRIME })
        const primeCart: any = await primeCartRes.json()
        const primeP1 = primeCart.data.lines.find((l: any) => l.productId === "P1")
        expect(primeP1.quantity).toBe(1)
    })
})

describe("OP-4 updateQuantity - Negative", () => {
    it("OP4-B1 (FR-2.5.1) quantity not integer returns 400 VALIDATION_ERROR", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 1.5 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("VALIDATION_ERROR")
    })

    it("OP4-B2 (FR-2.5.1) quantity as string returns 400 VALIDATION_ERROR", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: "2" }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("VALIDATION_ERROR")
    })

    it("OP4-B3 (FR-2.5.1) empty body returns 400 VALIDATION_ERROR", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({}),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("VALIDATION_ERROR")
    })

    it("OP4-B4 (FR-2.5.2) negative quantity returns 400 QTY_OUT_OF_RANGE", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: -1 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("QTY_OUT_OF_RANGE")
    })

    it("OP4-B5 (FR-2.5.3) item not in cart returns 404 ITEM_NOT_IN_CART", async () => {
        // cart has P1 only, updating P2
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        const res = await fetch(`${baseURL}/cart/items/P2`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 2 }),
        })

        expect(res.status).toBe(404)
        const body: any = await res.json()
        expect(body.error.code).toBe("ITEM_NOT_IN_CART")
    })

    it("OP4-B6 (FR-2.5.3, FR-2.6) nonexistent product returns 404 ITEM_NOT_IN_CART", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        const res = await fetch(`${baseURL}/cart/items/P9`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 1 }),
        })

        expect(res.status).toBe(404)
        const body: any = await res.json()
        expect(body.error.code).toBe("ITEM_NOT_IN_CART")
    })

    it("OP4-B7 (FR-2.5.4) product set to offSale returns 400 PRODUCT_UNAVAILABLE", async () => {
        // Add P1 to cart
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

        // Act -> try to update quantity of offSale item
        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 2 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("PRODUCT_UNAVAILABLE")
    })

    it("OP4-B8 (FR-2.5.5) quantity exceeds available stock returns 400 INSUFFICIENT_STOCK", async () => {
        // P2 has initial stock 3
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })

        // Try to update to 4 (> stock 3)
        const res = await fetch(`${baseURL}/cart/items/P2`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 4 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("INSUFFICIENT_STOCK")
    })

    it("OP4-B9 (FR-8.1) updating quantity in stage checkout returns 400 OPERATION_NOT_ALLOWED", async () => {
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

        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 3 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("OPERATION_NOT_ALLOWED")
    })

    it("OP4-B10 (FR-0.2) missing authorization header returns 401 AUTH_REQUIRED", async () => {
        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: JSON_HDR,
            body: JSON.stringify({ quantity: 2 }),
        })

        expect(res.status).toBe(401)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_REQUIRED")
    })

    it("OP4-B11 (FR-0.3.1) Admin token calling customer cart returns 403 AUTH_FORBIDDEN", async () => {
        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ quantity: 2 }),
        })

        expect(res.status).toBe(403)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_FORBIDDEN")
    })
})

describe("OP-4 updateQuantity - Boundary", () => {
    it("OP4-C1 (FR-2.5.2) quantity = 0 returns 400 QTY_OUT_OF_RANGE (not remove)", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 3 }),
        })

        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 0 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("QTY_OUT_OF_RANGE")

        // assert P1 is still 3 in cart
        const cartRes = await fetch(`${baseURL}/cart`, { headers: NORMAL })
        const cart: any = await cartRes.json()
        const p1 = cart.data.lines.find((l: any) => l.productId === "P1")
        expect(p1.quantity).toBe(3)
    })

    it("OP4-C2 (FR-2.5.2, FR-2.5.6) quantity = 1 (lower bound) succeeds", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 3 }),
        })

        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 1 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        const p1 = body.data.lines.find((l: any) => l.productId === "P1")
        expect(p1.quantity).toBe(1)
    })

    it("OP4-C3 (FR-2.5.2, FR-2.5.6) quantity = 10 (upper bound) succeeds", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 10 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        const p1 = body.data.lines.find((l: any) => l.productId === "P1")
        expect(p1.quantity).toBe(10)
    })

    it("OP4-C4 (FR-2.5.2) quantity = 11 (exceeds upper bound) returns 400 QTY_OUT_OF_RANGE", async () => {
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        const res = await fetch(`${baseURL}/cart/items/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 11 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("QTY_OUT_OF_RANGE")
    })

    it("OP4-C5 (FR-2.5.5, FR-2.5.6) quantity = exact available stock succeeds", async () => {
        // P2 has stock 3
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })

        const res = await fetch(`${baseURL}/cart/items/P2`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 3 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        const p2 = body.data.lines.find((l: any) => l.productId === "P2")
        expect(p2.quantity).toBe(3)
    })

    it("OP4-C6 (FR-2.5.5) quantity = stock + 1 returns 400 INSUFFICIENT_STOCK", async () => {
        // P2 has stock 3
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })

        const res = await fetch(`${baseURL}/cart/items/P2`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ quantity: 4 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("INSUFFICIENT_STOCK")
    })
})

