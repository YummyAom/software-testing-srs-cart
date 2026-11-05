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
