# Backend Checklist — Drinks E-Commerce (UK, single Admin role)

Source: Requirements Document dated 2026-09-18. Legend: `[x]` done, `[~]` exists but needs rework, `[ ]` not started.

## 0. Fix existing auth issues first
- [x] Register `GoogleStrategy` in AuthModule; add route that starts OAuth (`GET /auth/google`)
- [x] `googleCallback`: use express `res.redirect(url)` (currently returns a string and hangs)
- [x] Fix queue job name typo `'password-rest'` → `'password-reset'` (reset emails never send)
- [x] Confirm `jwt.sign` gets a secret (`JwtModule.register({})` has none) and use `JWT_EXPIRES_IN`
- [x] Decide on `User.jwt_token` (dropped; migration applied)
- [x] Add password min length + username regex to `CreateUserDto`
- [x] Add a `checkUsernameAvailability` route (service + DTO exist, no route)

## 1. Foundation
- [x] Swagger docs up to date for auth, categories, products (tags, bearer auth, DTO props, response envelope, error codes). **Rule: every new endpoint gets `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth('access-token')` if guarded, `@ApiProperty` on DTOs, and response docs via `src/common/response/api-response.doc.ts`.**
- [x] NestJS, Prisma/Postgres, BullMQ/Redis, Resend, Swagger, throttling, global error filter
- [x] Add `role` to User (`ADMIN` | `CUSTOMER`); replace hardcoded `"user"` in `VerifyOtpResponseDto`
- [x] `RolesGuard` + `@Roles()` decorator (Admin-only routes); include role in JWT/validate
- [x] Seed script for the single Admin account
- [ ] Env validation for new vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, age-check provider keys
- [ ] CORS origins from env (currently hardcoded localhost:3000)
- [ ] Tests: unit for services, e2e for checkout happy/failure paths

## 2. Categories (Admin — 3.1)
- [x] Prisma `Category` (name, slug unique)
- [x] Admin CRUD endpoints (guarded)
- [x] Delete rule: block or reassign when category has products
- [x] Public `GET /categories`

## 3. Products (Admin — 3.2; browsing — 4.1)
- [x] Prisma `Product`: name, description, images, price, discount, `weightGrams` (required), `isAgeRestricted`, `abv`, `brand`, `stock`/`inStock`, `categoryId`
- [x] Admin CRUD endpoints (guarded), DTO validation
- [x] Price stored in pence (integer); discount = percent for now (confirm with client)
- [x] Public list endpoint with pagination + filters: category, price range, ABV, brand, in-stock
- [x] Public product detail endpoint
- [x] Indexes on category, price, abv, brand for sub-second filtering
- [ ] Image storage decision (S3/Cloudinary/etc.) and upload endpoint

## 4. Cart (4.2)
- [x] Decide: server-side cart (guest via cart token/cookie) vs client-side cart validated at checkout
- [x] Add / update quantity / remove item endpoints (if server-side)
- [x] Validate stock and current price on every read
- [x] Merge guest cart into account cart on login

## 5. Customer accounts (Registered — section 2, decision 7)
- [x] Saved delivery address (model + get/update endpoints)
- [x] `GET /orders/me` order history
- [ ] Decide whether existing OTP-on-every-login flow stays for customers (friction vs security)
- [x] Guest checkout allowed with no account (name, email, address only)

## 6. Checkout (4.3)
- [x] `POST /checkout/quote`: cart totals, promo discount, **total order weight** and weight band (decision 2)
- [x] UK-only address validation (postcode format; reject non-UK)
- [x] Age-restriction check: any `isAgeRestricted` item triggers verification
- [x] Age verification: self-declared DOB (18+) behind a provider interface (`src/checkout/age-verification.ts`); **third-party provider still to choose**; failure blocks payment, no order, no charge
- [x] Store age-check outcome/audit data per UK GDPR (minimal data)
- [x] Promo codes: model (code, type, value, expiry, usage limit, min spend), Admin CRUD, validate/apply at quote, redeem atomically
- [x] Stripe: create PaymentIntent (or Checkout Session) server-side with amount computed on backend only
- [x] Stripe webhook (`payment_intent.succeeded` / failed), signature-verified, idempotent
- [x] On success only: create Order + items in one DB transaction, decrement stock, redeem promo
- [x] Guarantee no order without payment and no payment without an order (reconcile job for orphans)
- [x] Snapshot price, discount, weight and address on order items (later product edits must not change history)

## 7. Orders (Admin — 3.3)
- [x] Prisma `Order` + `OrderItem` + `OrderStatusHistory`
- [x] Unique, non-guessable **tracking ID** generated at order creation
- [x] Statuses: `PACKAGING → OUT_FOR_DELIVERY → DELIVERED` (linear only; reject skips/reversals)
- [x] Admin: list orders (filter by status, search) and get order detail
- [x] Admin: `PATCH /admin/orders/:id/status`
- [x] Every status change stored with timestamp + acting admin (auditability)
- [x] Trigger email on OUT_FOR_DELIVERY and DELIVERED

## 8. Public tracking (4.4)
- [x] `GET /tracking/:trackingId`: returns friendly status text (not raw enum), no PII leakage
- [x] Rate limit to prevent tracking-ID enumeration

## 9. Emails (section 5) — extend existing pg-boss/Resend setup
- [x] Queue moved from BullMQ/Redis to pg-boss 11 (Postgres `pgboss` schema); queues `email-otp`, `email-password-reset`, retries 3x with backoff, payloads purged after 15 min
- [x] Order receipt template with tracking ID (sent after payment verified)
- [x] Out-for-delivery template
- [x] Delivered template
- [ ] New pg-boss queues + `work()` handlers in `src/queues` (retries/backoff already configured)
- [ ] Delivery tracking (Resend webhooks/logging)  <- still open

## 10. Delivery / logistics (section 6)
- [x] Weight → courier band mapping used for shipping cost (config table or constants)
- [x] Shipping fee calculation in quote: weight-banded, **placeholder prices in `src/checkout/shipping.config.ts`, confirm with client**
- [x] Courier integration deferred (statuses manual); keep a `carrier`/`courierRef` nullable field so it can be added later
- [ ] Spike: Stuart vs Sendcloud/ShipEngine (after legal answer on age checks)

## 11. Compliance & data
- [x] Retain order/financial records ≥ 6 years (HMRC); never hard-delete orders
- [x] Separate PII/marketing data from order records so account deletion anonymises rather than deletes orders
- [x] No card data stored (Stripe only)
- [ ] Audit log for admin actions

## 12. Open items to confirm with client
- [ ] Age verification provider and whether checkout-only is legally sufficient
- [ ] Shipping fee model (free/flat/weight-banded) and stock-tracking depth (simple in-stock flag vs quantities, with no storekeeper role)
- [ ] Discount semantics (percent vs fixed) and promo rules
- [ ] Cart persistence for guests
- [ ] Guest data retention policy (doc says none planned; conflicts with 6-year HMRC rule)

## Client answers applied (2026-09-24)
- [x] Discounts are percentages; apply to items, not shipping; promo has a usage limit and a customer who arrives after the limit gets no discount (redemption is reserved when payment starts, released if abandoned/failed)
- [x] Stock is a plain number; admin low-stock warning = per-product `lowStockThreshold` (default 5), `GET /products/low-stock` and an email to verified admins when an order crosses the threshold
- [x] Keep order records incl. email + phone; guest orders auto-link to the account when the same email is verified (OTP/Google)
- [x] Phone number required at checkout and on the saved address; a single delivery address is enough

## Still open after cart/checkout/orders work
- [ ] Stripe webhook must be registered in the Stripe dashboard (or `stripe listen`) for each environment; prod needs a public URL
- [ ] Real third-party age verification provider (currently DOB self-declaration only) + legal sign-off
- [ ] Confirm shipping prices with client (discounts/promo/stock/retention answered above)
- [ ] Image upload/storage, Resend delivery webhooks, courier integration spike
- [ ] Account deletion that anonymises PII but keeps orders (orders.userId already SET NULL)
- [ ] Guest data retention policy; tracking-ID/receipt email link to frontend tracking page (needs frontend route)
- [ ] Rate-limit review for production; e2e test suite (only unit tests exist)

## Suggested build order
1. Section 0 + roles/guard (1)
2. Categories → Products → public browse/filter (2, 3)
3. Orders schema + tracking ID (7), then cart (4)
4. Checkout: quote, weight, promo, age check, Stripe + webhook (6)
5. Emails + Admin order status (9, 7), public tracking (8)
6. Customer account extras (5), hardening/tests (1, 11)
