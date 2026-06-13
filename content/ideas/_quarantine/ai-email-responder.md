---
slug: "ai-email-responder"
title: "AI Email Reply Drafter"
---

## The Problem

Email takes hours every day. Crafting professional responses is mentally draining, especially for non-native English speakers or anyone dealing with difficult emails. ChatGPT can help, but copying back and forth is tedious, and the tone is never quite right.

## The Solution

A focused tool for email replies. Paste the email you received, optionally add key points you want to include, select a tone, and get a polished reply. Learn your writing style from samples to match your voice perfectly.

**How it works:**

1. **Paste email** — The message you need to reply to
2. **Add notes** — Key points to include
3. **Get reply** — Ready to copy and send

## Market Research

- Professionals spend 28% of workweek on email (McKinsey)
- AI email tools like Superhuman and Shortwave charging $30/mo
- Simple, standalone reply tool—no need to replace entire email client

## AI Prompts to Build This

**1. Project Setup**

```text
Create a simple Next.js app for AI email replies.

Features:
- Input: paste email text
- Optional: key points/notes to include
- Tone selector: professional, friendly, firm, apologetic
- Output: generated reply with copy button
- History: recent replies for reference

Keep it fast and focused—no account needed for basic use.
```

**2. Reply Generation**

```text
Create the AI reply generation:

Prompt to Claude/GPT:
"You are an expert email writer. Write a reply to this email.
- Tone: {professional/friendly/firm/apologetic}
- Key points to include: {user's notes}
- Keep it concise but complete
- Match common professional email conventions
- Don't be overly formal or stiff
- Include appropriate greeting and sign-off"

Generate 2-3 variations so user can pick preferred style.
```

**3. Voice Learning**

```text
Add premium feature: learn user's writing style

1. User provides 5-10 sample emails they've written
2. AI analyzes: sentence length, vocabulary, greeting/closing style, common phrases
3. Create "style profile" stored with user account
4. Include style context in generation prompt
5. Result: replies that sound like the user actually wrote them

Charge for this as pro feature—clear value add.
```
