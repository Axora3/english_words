# Next phase: Axora purchase access

The current release adds registration identity, private profile photos and a visible profile screen. Purchase-only registration is intentionally deferred to the next phase requested by the owner. Registration is still open in this release.

## Verified source structure

Read-only review of `Axora/Axora` found:

- `src/app/api/orders/route.ts` stores the customer's email from `answers.q5` in `website_orders`.
- `supabase/migrations/20261106000000_order_payment.sql` adds manual `payment_status`, `quote_amount` and `paid_at`. Its comment explicitly says that an admin's `paid` marker is not a bank or gateway confirmation.
- `src/app/api/template-requests/route.ts` records a template request and email. A request alone is not a purchase.
- `src/app/api/integrations/payments/custom/notice/route.ts` verifies signed payment notices with the provider and matches invoice ID, amount and currency before calling `ecosystem_settle`. That integration concerns website subscriptions, so it must not automatically grant an English Words license.

No English Words product/license identifier was established in this review. Choose the exact product and entitlement duration before enabling a purchase gate. Do not grant access for an arbitrary paid website order.

## Implementation contract

1. Give the English Words product a stable ID (proposed: `english_words`) and tie a server-verified paid purchase to that ID and a normalized customer email.
2. The billing server writes an English Words entitlement with a unique purchase/event reference. Client roles cannot create, edit or read other customers' entitlements. Duplicate payment events cannot grant duplicate rights.
3. Registration checks entitlement on the auth server (a product-scoped pre-signup flow/hook), then requires email confirmation. A browser cannot supply a different email to claim another customer's purchase. Never use names or nicknames as proof of purchase.
4. Authorize an existing login using `auth.uid()` and the verified email from the auth server. Backfill existing users only from valid English Words purchases. Keep other applications' sign-up flows unchanged in this shared Supabase project.
5. Enforce the same entitlement in protected RPCs and RLS, including backups, profile and community actions. Hide the learning interface when access expires or is revoked. Define refund/revocation and email-change handling before launch.
6. Keep one active device. Signing in on another device transfers the active claim; the previous online device is blocked on its next check. The current app checks every 30 seconds while visible and before syncing. Offline static learning cannot immediately learn about a remote takeover; immediate revocation would require online authorization.

## Required validation

Test paid vs unpaid, wrong product, unconfirmed email, differing letter case, another customer's email, expired/refunded grants, duplicate provider events, existing accounts and two-device takeover. Keep all service-role credentials on the server. Do not change Axora payment data during implementation tests.
