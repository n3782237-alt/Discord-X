# Discord X — Demo refund policy

**This document applies only to the virtual X-Coins purchase simulation included in this starter. It does not describe refunds of real money.**

## 24-hour request window
A user may request a refund of a recorded demo subscription purchase within 24 hours after the purchase timestamp.

## What happens
If the request is eligible:
1. The recorded virtual X-Coins amount is returned to the user's in-app wallet.
2. The subscription tier is changed back to the tier recorded immediately before that purchase.
3. The purchase record is marked as refunded so it cannot be refunded twice.

## Limits
- A purchase can only be refunded once.
- The refund endpoint rejects requests after 24 hours.
- The endpoint returns virtual X-Coins only. It does not return cash or reverse a bank/card transaction.
- The current demo UI keeps the latest purchase ID in the local app session. A production version should add a persistent purchase history and a self-service refund screen.

## Real payments
If real payments are added, this document must be replaced with reviewed terms that comply with the payment provider's rules and applicable consumer-protection laws. Real refunds must be processed through the payment provider and confirmed by its server-side webhook. Do not describe the demo coin restoration as a real-money refund.
