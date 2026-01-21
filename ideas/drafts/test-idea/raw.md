# Invoice Reminder Bot

## The Problem

Freelancers and small agencies lose thousands of dollars each year to late-paying clients. Most don't have the time or systems to follow up on overdue invoices consistently. It's awkward to chase payments, and manual tracking in spreadsheets is error-prone.

Common pain points from Reddit/Twitter:
- "I hate being the bad guy asking for money"
- "I forgot to follow up and now it's been 3 months"
- "My clients pay faster when they get automated reminders but I don't have time to set it up"

## Who It's For

- Freelance developers, designers, writers
- Small creative agencies (2-10 people)
- Consultants and coaches
- Anyone using Stripe, PayPal, or manual invoicing

## The Solution

An automated invoice reminder system that:
- Connects to your invoicing tool (Stripe, FreshBooks, or manual CSV)
- Sends polite, escalating reminder emails automatically
- Tracks payment status and follow-up history
- Takes the emotional burden off the freelancer

Key features:
- Pre-written email templates (friendly -> firm -> final notice)
- Customizable timing (3 days, 7 days, 14 days, 30 days overdue)
- Client portal to view invoice status
- Slack/email notifications when payments come in

## How It Would Work

1. Connect your Stripe account or upload invoice CSV
2. Set your reminder schedule (or use defaults)
3. Customize email templates with your branding
4. Bot sends reminders automatically when invoices go overdue
5. Get notified when clients pay

## Market Research

- 59 million freelancers in the US (Upwork 2023)
- Average freelancer has $10k+ in unpaid invoices at any time
- Late payments cost small businesses $3 trillion annually
- Competitors charge $30-100/month, showing willingness to pay

Reddit threads with 500+ upvotes asking for exactly this tool.

## Competitors

**FreshBooks** - Full accounting suite, $17-55/month, overkill for just reminders
**Harvest** - Time tracking focused, reminders are afterthought, $12/month
**InvoiceNinja** - Open source but complex setup, free-$14/month
**Manual follow-up** - Most freelancers just forget or feel awkward

Gap in market: Simple, focused reminder bot without the accounting bloat.

## Business Model

Freemium model:
- **Free**: 5 active invoices, 2 reminder templates
- **Pro ($19/month)**: Unlimited invoices, custom templates, Slack integration
- **Agency ($49/month)**: Team accounts, white-label emails, priority support

Unit economics:
- CAC estimate: $30 (content marketing, word of mouth)
- LTV at Pro tier: $228 (12 month retention)
- LTV:CAC ratio: 7.6x

## Tech Stack

- **Frontend**: Next.js + Tailwind for dashboard
- **Backend**: Next.js API routes or separate Express server
- **Database**: Supabase (Postgres + Auth)
- **Email**: Resend or SendGrid for transactional emails
- **Integrations**: Stripe API, FreshBooks API
- **Cron**: Vercel cron or separate worker for scheduled reminders

MVP could be built in a weekend with just Stripe integration.
