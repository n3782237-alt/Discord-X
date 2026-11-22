# Discord X — Privacy and Security Policy (development template)

**Status:** Draft template for a development project, not legal advice and not a final legally reviewed policy. Replace the placeholders and have the policy reviewed before making the service public.

## Information this starter processes
- Email address and username for account creation and sign-in.
- Password hash (the original password is not stored).
- Messages and channel/server membership to provide chat features.
- Virtual X-Coins balance, subscription tier and demo purchase/refund records.
- Basic connection/session data needed to authenticate requests and realtime connections.

## Why the information is used
To create accounts, verify email addresses, authenticate users, deliver messages, operate communities and voice rooms, and maintain the virtual-credit demo purchase ledger.

## Security measures in this starter
- Passwords are hashed with bcrypt.
- API routes require a signed JWT for authenticated actions.
- Database access is performed through Prisma.
- Verification codes expire after 10 minutes and are stored as hashes.
- Purchase and refund balance changes are performed in database transactions.

These measures do not guarantee that the app is secure. The development configuration is not production-ready.

## User responsibilities
Do not share passwords, verification codes, payment details or other secrets in messages. Use a unique password and keep your device secure.

## Production requirements
Before public release, the operator must publish a real contact address, identify the legal service operator, state hosting and retention locations, configure HTTPS, protect secrets, add rate limiting and abuse prevention, provide account deletion/export, define retention periods and obtain legal review.

## Demo billing notice
X-Coins, Premium and Premium PRO in this starter are simulated virtual features. The app does not collect card data or charge real money. The demo refund endpoint restores virtual X-Coins only.
