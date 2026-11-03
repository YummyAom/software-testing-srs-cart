import { Navigate, Route, Routes } from "react-router-dom"
import { StageGuard } from "./components/stage-guard"
import { AuthProvider } from "./context/auth-context"
import AdminCouponsPage from "./pages/admin-coupons"
import AdminProductsPage from "./pages/admin-products"
import CartPage from "./pages/cart"
import CheckoutPage from "./pages/checkout"
import LoginPage from "./pages/login"
import OrderDetailPage from "./pages/order-detail"
import OrdersPage from "./pages/orders"
import ProductsPage from "./pages/products"
import SuccessPage from "./pages/success"

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/cart" element={<StageGuard page="cart"><CartPage /></StageGuard>} />
        <Route path="/checkout" element={<StageGuard page="checkout"><CheckoutPage /></StageGuard>} />
        <Route path="/success" element={<StageGuard page="success"><SuccessPage /></StageGuard>} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        <Route path="/admin/products" element={<AdminProductsPage />} />
        <Route path="/admin/coupons" element={<AdminCouponsPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
