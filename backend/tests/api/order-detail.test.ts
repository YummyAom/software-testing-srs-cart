import { describe, it, expect, beforeAll, beforeEach } from "vitest"

const PORT = process.env.API_PORT ?? 3001
const baseURL = `http://localhost:${PORT}`
const JSON_HDR = { "Content-Type": "application/json" }
const MISSING_ORDER_ID = "00000000-0000-0000-0000-000000000000"

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

describe("OP-14 viewOrder - Happy Path", () => {
    it("OP14-A1 view own order shows the saved snapshot", async () => {
        // Precondition -> cus_normal checkout P1 x 2 (900 baht, 600 g = light, inCity standard normal = 30)
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

        const res = await fetch(`${baseURL}/orders/${orderId}`, {
            headers: NORMAL,
        })

        expect(res.status).toBe(200)

        const body: any = await res.json()
        expect(body.data.orderId).toBe(orderId)
        expect(body.data.status).toBe("pending")
        expect(body.data.lines.map((l: any) => ({ productId: l.productId, name: l.name, unitPrice: l.unitPrice, quantity: l.quantity }))).toEqual([
            { productId: "P1", name: "Coffee Beans 250g", unitPrice: 450, quantity: 2 },
        ])
        expect(body.data.subtotal).toBe(900)
        expect(body.data.discount).toBe(0)
        expect(body.data.shippingFee).toBe(30)
        expect(body.data.netTotal).toBe(930)
        expect(body.data.zone).toBe("inCity")
        expect(body.data.speed).toBe("standard")
        expect(body.data.couponCode).toBe(null)
    })

    it("OP14-A2 (AC-13) order keeps old price after admin changes it", async () => {
        // Precondition -> cus_normal checkout P1 x 1 (price 450), then admin sets P1 price = 500
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
        const checkoutBody: any = await checkoutRes.json()
        const orderId = checkoutBody.data.order.orderId
        const updateRes = await fetch(`${baseURL}/admin/products/P1`, {
            method: "PUT",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ price: 500 }),
        })
        expect(updateRes.status).toBe(200)

        const res = await fetch(`${baseURL}/orders/${orderId}`, {
            headers: NORMAL,
        })

        expect(res.status).toBe(200)

        const body: any = await res.json()
        expect(body.data.lines[0].unitPrice).toBe(450)

        // assert the cart that still has P1 shows the new price
        const cartRes = await fetch(`${baseURL}/cart`, { headers: NORMAL })
        const cartBody: any = await cartRes.json()
        const p1 = cartBody.data.lines.find((l: any) => l.productId === "P1")
        expect(p1.unitPrice).toBe(500)
    })

    it("OP14-A3 (FR-8.5.2, FR-5.3.6) order is readable at stage cart and ignores later cart edits", async () => {
        // Precondition -> cus_normal checkout P1 x 2, cancel, then add P2 x 1 to the cart
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
        expect(checkoutRes.status).toBe(201)
        const checkoutBody: any = await checkoutRes.json()
        const orderId = checkoutBody.data.order.orderId
        const cancelRes = await fetch(`${baseURL}/cart/checkout`, {
            method: "DELETE",
            headers: NORMAL,
        })
        expect(cancelRes.status).toBe(200)
        const addRes = await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })
        expect(addRes.status).toBe(200)

        const res = await fetch(`${baseURL}/orders/${orderId}`, {
            headers: NORMAL,
        })

        expect(res.status).toBe(200)

        const body: any = await res.json()
        expect(body.data.status).toBe("cancelled")
        expect(body.data.lines.map((l: any) => ({ productId: l.productId, quantity: l.quantity }))).toEqual([
            { productId: "P1", quantity: 2 },
        ])
        expect(body.data.subtotal).toBe(900)
    })

    it("OP14-A4 (FR-8.5.2, FR-5.3.6) order is readable at stage success and keeps coupon after admin disables it", async () => {
        // Precondition -> cus_prime P2 x 1 + SAVE10 checkout (1,200 - 120 + shipping 0), pay success, admin disables SAVE10
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...PRIME, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })
        await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...PRIME, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })
        const checkoutRes = await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...PRIME, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })
        expect(checkoutRes.status).toBe(201)
        const checkoutBody: any = await checkoutRes.json()
        const orderId = checkoutBody.data.order.orderId
        const payRes = await fetch(`${baseURL}/orders/${orderId}/pay-success`, {
            method: "POST",
            headers: JSON_HDR,
            body: JSON.stringify({ result: "success" }),
        })
        expect(payRes.status).toBe(200)
        const disableRes = await fetch(`${baseURL}/admin/coupons/SAVE10/status`, {
            method: "POST",
            headers: { ...ADMIN, ...JSON_HDR },
            body: JSON.stringify({ status: "inactive" }),
        })
        expect(disableRes.status).toBe(200)

        const res = await fetch(`${baseURL}/orders/${orderId}`, {
            headers: PRIME,
        })

        expect(res.status).toBe(200)

        const body: any = await res.json()
        expect(body.data.status).toBe("paid")
        expect(body.data.couponCode).toBe("SAVE10")
        expect(body.data.subtotal).toBe(1200)
        expect(body.data.discount).toBe(120)
        expect(body.data.shippingFee).toBe(0)
        expect(body.data.netTotal).toBe(1080)
    })
})

describe("OP-14 viewOrder - AC-15", () => {
    it("OP14-B1 (AC-15) another customer cannot view the order", async () => {
        // Precondition -> cus_normal has order X
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
        const checkoutBody: any = await checkoutRes.json()
        const orderId = checkoutBody.data.order.orderId

        const res = await fetch(`${baseURL}/orders/${orderId}`, {
            headers: PRIME,
        })

        expect(res.status).toBe(404)

        const body: any = await res.json()
        expect(body.error.code).toBe("ORDER_NOT_FOUND")
    })
})

describe("OP-14 viewOrder - Negative", () => {
    it("OP14-B2 (FR-0.5.2) order that does not exist gives the same error as another customer's order", async () => {
        // Precondition -> cus_normal has order X, cus_prime gets the error for another customer's order
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
        const checkoutBody: any = await checkoutRes.json()
        const orderId = checkoutBody.data.order.orderId
        const otherRes = await fetch(`${baseURL}/orders/${orderId}`, {
            headers: PRIME,
        })
        const otherBody: any = await otherRes.json()

        const res = await fetch(`${baseURL}/orders/${MISSING_ORDER_ID}`, {
            headers: NORMAL,
        })

        expect(res.status).toBe(404)

        const body: any = await res.json()
        expect(body.error.code).toBe("ORDER_NOT_FOUND")
        expect(body.error.message).toBe(otherBody.error.message)
    })

    it("OP14-B3 (FR-0.2) no token returns 401 AUTH_REQUIRED", async () => {
        // Precondition -> order X exists, so the missing token is the only fault
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
        const checkoutBody: any = await checkoutRes.json()
        const orderId = checkoutBody.data.order.orderId

        const res = await fetch(`${baseURL}/orders/${orderId}`)

        expect(res.status).toBe(401)

        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_REQUIRED")
    })

    it("OP14-B4 (FR-0.3.1) admin token returns 403 AUTH_FORBIDDEN", async () => {
        // Precondition -> order X exists, so the role is the only fault
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
        const checkoutBody: any = await checkoutRes.json()
        const orderId = checkoutBody.data.order.orderId

        const res = await fetch(`${baseURL}/orders/${orderId}`, {
            headers: ADMIN,
        })

        expect(res.status).toBe(403)

        const body: any = await res.json()
        expect(body.error.code).toBe("AUTH_FORBIDDEN")
    })
})
