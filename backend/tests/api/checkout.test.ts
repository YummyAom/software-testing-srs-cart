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

describe("OP-8 pressCheckout - Happy Path", () => {
    it("OP8-A1 (AC-11a) checkout creates pending order and reserves stock", async () => {
        // Precondition -> cus_normal P2 x 3 in cart (P2 stock 3)
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 3 }),
        })

        const res = await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })

        expect(res.status).toBe(201)

        const body: any = await res.json()
        expect(body.data.order.status).toBe("pending")
        expect(body.data.customer.stage).toBe("checkout")

        // assert P2 stock is reserved to 0; admin sees every product (FR-1.3.2)
        const productsRes = await fetch(`${baseURL}/products`, { headers: ADMIN })
        const productsBody: any = await productsRes.json()
        const p2 = productsBody.data.products.find((p: any) => p.productId === "P2")
        expect(p2.availableStock).toBe(0)
    })
})

describe("OP-9 cancelCheckout - Happy Path", () => {
    it("OP9-A1 (AC-12) cancel returns order, stock and cart", async () => {
        // Precondition -> cus_normal checkout P2 x 3 (P2 stock 0)
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 3 }),
        })
        await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })

        const res = await fetch(`${baseURL}/cart/checkout`, {
            method: "DELETE",
            headers: NORMAL,
        })

        expect(res.status).toBe(200)

        const body: any = await res.json()
        expect(body.data.order.status).toBe("cancelled")
        expect(body.data.cart.stage).toBe("cart")
        expect(body.data.cart.lines.map((l: any) => ({ productId: l.productId, quantity: l.quantity }))).toEqual([
            { productId: "P2", quantity: 3 },
        ])

        // assert stock of P2 is back to 3
        const productsRes = await fetch(`${baseURL}/products`, { headers: NORMAL })
        const productsBody: any = await productsRes.json()
        const p2 = productsBody.data.products.find((p: any) => p.productId === "P2")
        expect(p2.availableStock).toBe(3)
    })

    it("OP9-A2 coupon used in the order stays on the cart", async () => {
        // Precondition -> cus_prime P2 x 1 (1,200 >= minSpend 1,000) + SAVE10, checkout uses the coupon
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
        await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...PRIME, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })

        const res = await fetch(`${baseURL}/cart/checkout`, {
            method: "DELETE",
            headers: PRIME,
        })

        expect(res.status).toBe(200)

        const body: any = await res.json()
        expect(body.data.cart.couponCode).toBe("SAVE10")
    })

    it("OP9-A3 coupon removed at checkout is not bound again", async () => {
        // Precondition -> cus_prime P1 x 2 (900 < minSpend 1,000) + SAVE10, checkout removes the coupon
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...PRIME, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 2 }),
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

        // assert the coupon really was bound and then removed at checkout
        const checkoutBody: any = await checkoutRes.json()
        expect(checkoutBody.messages.map((m: any) => m.code)).toContain("COUPON_NOT_APPLICABLE")

        const res = await fetch(`${baseURL}/cart/checkout`, {
            method: "DELETE",
            headers: PRIME,
        })

        expect(res.status).toBe(200)

        const body: any = await res.json()
        expect(body.data.cart.couponCode).toBe(null)
    })

    it("OP9-A4 cart can be edited after cancel", async () => {
        // Precondition -> cus_normal checkout P2 x 3 then cancel
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 3 }),
        })
        await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })
        await fetch(`${baseURL}/cart/checkout`, {
            method: "DELETE",
            headers: NORMAL,
        })

        const res = await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P1", quantity: 1 }),
        })

        expect(res.status).toBe(200)

        const body: any = await res.json()
        expect(body.data.lineCount).toBe(2)
    })

    it("OP9-A5 checkout again after cancel creates a new orderId", async () => {
        // Precondition -> cus_normal checkout P2 x 3 then cancel
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 3 }),
        })
        const firstRes = await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })
        const firstBody: any = await firstRes.json()
        const firstOrderId = firstBody.data.order.orderId
        await fetch(`${baseURL}/cart/checkout`, {
            method: "DELETE",
            headers: NORMAL,
        })

        const res = await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })

        expect(res.status).toBe(201)

        const body: any = await res.json()
        expect(body.data.order.status).toBe("pending")
        expect(body.data.order.orderId).not.toBe(firstOrderId)
    })
})

describe("OP-10 paySuccess - Happy Path", () => {
    it("OP10-A1 (AC-18a) pay success clears cart and moves to stage success", async () => {
        // Precondition -> cus_normal P2 x 1 (1,200 >= minSpend 1,000) + SAVE10, checkout uses the coupon
        await fetch(`${baseURL}/cart/items`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ productId: "P2", quantity: 1 }),
        })
        await fetch(`${baseURL}/cart/coupon`, {
            method: "PUT",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ code: "SAVE10" }),
        })
        const checkoutRes = await fetch(`${baseURL}/cart/checkout`, {
            method: "POST",
            headers: { ...NORMAL, ...JSON_HDR },
            body: JSON.stringify({ zone: "inCity", speed: "standard" }),
        })
        const checkoutBody: any = await checkoutRes.json()
        const orderId = checkoutBody.data.order.orderId

        const res = await fetch(`${baseURL}/orders/${orderId}/pay-success`, {
            method: "POST",
            headers: JSON_HDR,
            body: JSON.stringify({ result: "success" }),
        })

        expect(res.status).toBe(200)

        const body: any = await res.json()
        expect(body.data.order.status).toBe("paid")
        expect(body.data.customer.stage).toBe("success")

        // assert cart is empty and has no coupon
        const cartRes = await fetch(`${baseURL}/cart`, { headers: NORMAL })
        const cartBody: any = await cartRes.json()
        expect(cartBody.data.lineCount).toBe(0)
        expect(cartBody.data.couponCode).toBe(null)
    })
})

describe("OP-11 payFail - Happy Path", () => {
    it("OP11-A1 pay fail keeps stage, order and stock reservation", async () => {
        // Precondition -> cus_normal checkout P2 x 3 (P2 stock 0)
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
        const checkoutBody: any = await checkoutRes.json()
        const orderId = checkoutBody.data.order.orderId

        const res = await fetch(`${baseURL}/orders/${orderId}/pay-fail`, {
            method: "POST",
            headers: JSON_HDR,
            body: JSON.stringify({ result: "fail" }),
        })

        expect(res.status).toBe(200)

        const body: any = await res.json()
        expect(body.messages.map((m: any) => m.message)).toContain("การชำระเงินล้มเหลว กรุณาลองใหม่")
        expect(body.data.order.status).toBe("pending")
        expect(body.data.customer.stage).toBe("checkout")

        // assert P2 is still reserved; admin sees every product (FR-1.3.2), a customer would not see P2 at stock 0
        const productsRes = await fetch(`${baseURL}/products`, { headers: ADMIN })
        const productsBody: any = await productsRes.json()
        const p2 = productsBody.data.products.find((p: any) => p.productId === "P2")
        expect(p2.availableStock).toBe(0)
    })

    it("OP11-A2 pay again after fail succeeds", async () => {
        // Precondition -> cus_normal checkout P1 x 1 then gateway payFail once
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
        await fetch(`${baseURL}/orders/${orderId}/pay-fail`, {
            method: "POST",
            headers: JSON_HDR,
            body: JSON.stringify({ result: "fail" }),
        })

        const res = await fetch(`${baseURL}/orders/${orderId}/pay-success`, {
            method: "POST",
            headers: JSON_HDR,
            body: JSON.stringify({ result: "success" }),
        })

        expect(res.status).toBe(200)

        const body: any = await res.json()
        expect(body.data.order.status).toBe("paid")
    })
})
