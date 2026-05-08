# ADR-002: Dual Email Delivery Strategy — Resend API with SMTP Fallback

## Context

The service must send two types of transactional emails:

1. **Confirmation email** — sent immediately when a user subscribes.
2. **Release notification email** — sent by the background scanner when a new release is detected.

Email delivery reliability is critical: a failed confirmation email prevents the user from activating their subscription, and a failed notification email means they miss a release. At the same time, the service needs to be deployable with minimal configuration in local and CI environments where a full SMTP server may not be available.

Two distinct operational needs arise:

- **Production:** high deliverability, managed sending infrastructure, no self-hosted SMTP server.
- **Local / CI:** ability to test email flows without a production API key.

## Decision

Implement a **strategy-based email driver** in `src/services/emailService.js`:

1. **Primary driver — Resend API** (`resend` npm package via HTTP): used when `RESEND_API_KEY` is set.
2. **Fallback driver — Nodemailer SMTP**: used when `RESEND_API_KEY` is absent but `SMTP_USER` and `SMTP_PASS` are configured.
3. If neither is configured, the service throws a descriptive `503` error at subscription time, making the misconfiguration immediately visible.

Driver selection happens at runtime based on environment variables, no code change or restart beyond env var update is required to switch drivers.

## Considered Alternatives

| Option                                        | Reason rejected                                                                                                                                                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resend API only**                           | Would make local development and CI without a Resend API key impossible, also creates a hard dependency on a third-party service.                                                                                           |
| **Nodemailer SMTP only**                      | Reliable SMTP delivery in production requires either a self-hosted MTA (operational overhead) or a paid SMTP relay (similar cost to Resend with worse DX).                                                                  |
| **SendGrid / Mailgun / AWS SES**              | Functionally equivalent to Resend for this use case. Resend has a simpler API and better developer ergonomics for a new project. The fallback pattern means swapping providers requires only a new driver implementation.   |
| **Queue-based async delivery (Bull + Redis)** | Would improve resilience for the scanner's bulk sends, but adds significant complexity. The current sequential approach is sufficient at the expected scale; this can be added later without changing the driver interface. |

## Consequences

**Positive:**

- Production deployments use Resend's managed infrastructure — no SMTP server to maintain, good deliverability out of the box.
- Local and CI setups can use Gmail SMTP or any standard SMTP relay with only env var configuration.
- The abstraction (`emailService.sendConfirmationEmail`, `emailService.sendReleaseNotification`) makes it trivial to add a third driver (e.g., AWS SES) without changing callers.
- Failed delivery at subscription time is handled atomically: if the email cannot be sent, the subscription row is deleted and the user receives a clear error.

**Negative:**

- The current implementation uses a simple `if/else` driver selection — adding more drivers will eventually warrant a formal factory/registry pattern.
- Resend free tier limits (100 emails/day, single verified sender domain) are insufficient for production scale, a paid plan and a verified custom domain are required.
- Sequential email sending in the scanner (one `await` per subscriber) means a slow or temporarily unavailable email provider blocks the entire scanner tick.

## Notes

Both drivers respect a configurable timeout (`RESEND_TIMEOUT_MS`, `SMTP_CONNECTION_TIMEOUT_MS`). The scanner's per-subscriber send is wrapped in a `try/catch` so a single delivery failure does not stop notifications for other subscribers or other repos.

The `from` address used for sending is driven by `RESEND_FROM` (Resend) or `EMAIL_FROM` (SMTP), both falling back to a default `noreply@notificator.app` value.
