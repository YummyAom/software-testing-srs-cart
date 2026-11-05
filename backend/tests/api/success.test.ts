import { describe, it, expect, beforeEach } from "vitest"

const PORT = process.env.API_PORT ?? 3001
const baseURL = `http://localhost:${PORT}`
const JSON_HDR = { "Content-Type": "application/json" }

let NORMAL: Record<string, string>

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
    const reset = await fetch(`${baseURL}/test/reset`, {
        method: "POST",
        headers: { "x-test-reset-token": process.env.TEST_RESET_TOKEN ?? "" },
    })
    expect(reset.status).toBe(200)

    NORMAL = await loginAs("cus_normal", process.env.SEED_PASSWORD_CUSTOMER_NORMAL)
})

describe("OP-12 continueShopping - /success page", () => {
    it("OP12-A1 (AC-18b) continueShopping from stage success returns to stage cart with empty cart", async () => {
        // Precondition -> cus_normal has P1 x 1, checkouts, and payment succeeds to reach stage success
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

        const payRes = await fetch(`${baseURL}/orders/${orderId}/pay-success`, {
            method: "POST",
            headers: JSON_HDR,
            body: JSON.stringify({ result: "success" }),
        })
        expect(payRes.status).toBe(200)

        // Act: continueShopping
        const res = await fetch(`${baseURL}/cart/continue`, {
            method: "POST",
            headers: NORMAL,
        })

        // Assert
        expect(res.status).toBe(200)
        const body: any = await res.json()
        expect(body.data.stage).toBe("cart")
        expect(body.data.lineCount).toBe(0)
        expect(body.data.couponCode).toBe(null)
    }, 35000)

    it("OP12-B1 continueShopping rejected when in stage cart (FR-8.4, FR-8.5.1)", async () => {
        // Precondition -> cus_normal is in stage cart (initial state)
        const res = await fetch(`${baseURL}/cart/continue`, {
            method: "POST",
            headers: NORMAL,
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("OPERATION_NOT_ALLOWED")
    })

    it("OP12-B2 continueShopping rejected when in stage checkout (FR-8.4, FR-8.5.1)", async () => {
        // Precondition -> cus_normal has P1 x 1, checkouts to reach stage checkout
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

        // Act: try continueShopping while in checkout
        const res = await fetch(`${baseURL}/cart/continue`, {
            method: "POST",
            headers: NORMAL,
        })

        expect(res.status).toBe(400)
        const body: any = await res.json()
        expect(body.error.code).toBe("OPERATION_NOT_ALLOWED")
    })
})
