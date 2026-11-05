import { describe, it, expect, beforeEach } from "vitest"

const PORT = process.env.API_PORT ?? 3001
const baseURL = `http://localhost:${PORT}`
const JSON_HDR = { "Content-Type": "application/json" }

let NORMAL: Record<string, string>
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
    ADMIN = await loginAs("admin01", process.env.SEED_PASSWORD_ADMIN)
})

// =============================================================================
// OP-15: updateProduct(productId, price?, stock?) - PUT /admin/products/:productId
// =============================================================================

describe("OP-15 updateProduct - Happy Path", () => {
    it("OP15-A1 (FR-9.1.2) update price only", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 500 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.productId).toBe("P1")
        expect(body.data.price).toBe(500)
        expect(body.data.availableStock).toBe(20) // stock intact
    })

    it("OP15-A2 (FR-9.1.2) update stock only", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ stock: 5 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.productId).toBe("P1")
        expect(body.data.price).toBe(450) // price intact
        expect(body.data.availableStock).toBe(5)
    })

    it("OP15-A3 (FR-9.1.2) update both price and stock", async () => {
        const res = await fetch(`${baseURL}/admin/products/P2`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 1000, stock: 10 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.productId).toBe("P2")
        expect(body.data.price).toBe(1000)
        expect(body.data.availableStock).toBe(10)
    })

    it("OP15-A4 (FR-9.2.1) updated price immediately reflects in customer cart", async () => {
        // Customer has P1 x 2 in cart
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

        // Customer views cart
        const cartRes = await fetch(`${baseURL}/cart`, { headers: NORMAL })
        expect(cartRes.status).toBe(200)
        const cartBody: any = await cartRes.json()
        const p1 = cartBody.data.lines.find((l: any) => l.productId === "P1")
        expect(p1.unitPrice).toBe(500)
        expect(cartBody.data.subtotal).toBe(1000)
    })

    it("OP15-A5 (FR-9.2.2) updated price does not affect already created orders", async () => {
        // Customer checkouts P1 x 2 at 450
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 2 }),
        })
        const checkoutRes = await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })
        const checkoutBody: any = await checkoutRes.json()
        const orderId = checkoutBody.data.order.orderId

        // Admin updates P1 price to 600
        await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 600 }),
        })

        // View order snapshot -> unitPrice in order line remains 450
        const orderRes = await fetch(`${baseURL}/orders/${orderId}`, { headers: NORMAL })
        expect(orderRes.status).toBe(200)
        const orderBody: any = await orderRes.json()
        const line = orderBody.data.lines.find((l: any) => l.productId === "P1")
        expect(line.unitPrice).toBe(450)
        expect(orderBody.data.subtotal).toBe(900)
    })
})

describe("OP-15 updateProduct - Negative", () => {
    it("OP15-B1 (FR-9.1.1) nonexistent product returns 404 PRODUCT_NOT_FOUND", async () => {
        const res = await fetch(`${baseURL}/admin/products/P9`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 500 }),
        })

        expect(res.status).toBe(404)
        const body: any = await res.json()
        expect(body.error.code).toBe("PRODUCT_NOT_FOUND")
    })

    it("OP15-B2 (FR-9.1.1) nonexistent product with invalid fields returns 404 (product existence checked first)", async () => {
        const res = await fetch(`${baseURL}/admin/products/P9`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 0 }),
        })

        expect(res.status).toBe(404)
        const body: any = await res.json()
        expect(body.error.code).toBe("PRODUCT_NOT_FOUND")
    })

    it("OP15-B3 (FR-9.1.1) empty body returns 400 VALIDATION_ERROR", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({}),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("VALIDATION_ERROR")
    })

    it("OP15-B4 (FR-9.1.1) both price and stock invalid returns 400 with both fields in details", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 0, stock: -1 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("VALIDATION_ERROR")
        expect(body.error.details.fields).toContain("price")
        expect(body.error.details.fields).toContain("stock")
    })

    it("OP15-B5 (FR-9.1.1, FR-0.7) valid price with invalid stock rolls back both", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 500, stock: 10000 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("VALIDATION_ERROR")
        expect(body.error.details.fields).toContain("stock")

        // Assert P1 price is NOT updated to 500
        const checkRes = await fetch(`${baseURL}/products`, { headers: ADMIN })
        const checkBody: any = await checkRes.json()
        const p1 = checkBody.data.products.find((p: any) => p.productId === "P1")
        expect(p1.price).toBe(450)
    })

    it("OP15-B6 (FR-9.1.1) price as float or string returns 400 VALIDATION_ERROR", async () => {
        const resFloat = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 10.5 }),
        })
        expect(resFloat.status).toBe(400)

        const resStr = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: "500" }),
        })
        expect(resStr.status).toBe(400)
    })

    it("OP15-B7 (FR-0.2) missing authorization header returns 401 AUTH_REQUIRED", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: JSON_HDR,
            body: JSON.stringify({ price: 500 }),
        })

        expect(res.status).toBe(401)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_REQUIRED")
    })

    it("OP15-B8 (FR-0.3.2) Customer token calling admin update returns 403 AUTH_FORBIDDEN", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ price: 500 }),
        })

        expect(res.status).toBe(403)
        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_FORBIDDEN")
    })
})

describe("OP-15 updateProduct - Boundary", () => {
    it("OP15-C1 (FR-9.1.1) price = 0 returns 400 VALIDATION_ERROR", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 0 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("VALIDATION_ERROR")
    })

    it("OP15-C2 (FR-9.1.1, FR-9.1.2) price = 1 (lower bound) succeeds", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 1 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.price).toBe(1)
    })

    it("OP15-C3 (FR-9.1.1, FR-9.1.2) price = 50,000 (upper bound) succeeds", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 50000 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.price).toBe(50000)
    })

    it("OP15-C4 (FR-9.1.1) price = 50,001 (exceeds upper bound) returns 400 VALIDATION_ERROR", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 50001 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("VALIDATION_ERROR")
    })

    it("OP15-C5 (FR-9.1.1) stock = -1 returns 400 VALIDATION_ERROR", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ stock: -1 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("VALIDATION_ERROR")
    })

    it("OP15-C6 (FR-9.1.1, FR-9.1.2) stock = 0 (lower bound, out of stock) succeeds", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ stock: 0 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.availableStock).toBe(0)
    })

    it("OP15-C7 (FR-9.1.1, FR-9.1.2) stock = 9,999 (upper bound) succeeds", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ stock: 9999 }),
        })

        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.availableStock).toBe(9999)
    })

    it("OP15-C8 (FR-9.1.1) stock = 10,000 (exceeds upper bound) returns 400 VALIDATION_ERROR", async () => {
        const res = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ stock: 10000 }),
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("VALIDATION_ERROR")
    })
})

