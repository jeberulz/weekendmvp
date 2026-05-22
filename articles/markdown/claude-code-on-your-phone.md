---
title: "Claude Code on Your Phone: How to Ship MVPs from Anywhere"
description: "Four real workflows for running Claude Code from your iPhone, iPad, or Android. Termius + Tailscale, GitHub Codespaces, the GitHub Action, and Catnip. Ship from the couch."
date: "2026-05-01"
author: "John Iseghohi"
slug: "claude-code-on-your-phone"
---

# Claude Code on Your Phone

Four real workflows for shipping MVPs from your iPhone, iPad, or Android—without sitting in front of your laptop.


![small leather-bound pocket notebook open on a dark surface, a lime ribbon-marker draped across a half-written page](https://weekendmvp.app/image/og/article/claude-code-on-your-phone.png)
---

## Why You'd Want This

- You're on the train and a fix is two lines.
- You're on a trip without your laptop and your weekend MVP got a wave of users.
- You want to keep building during a meeting you don't need to be in.
- You want your dev environment to follow you, not the other way around.

Phones aren't great for building from scratch. They're excellent for reviewing, fixing, and shipping.

---

## Three Honest Limits

1. **Don't start a project from scratch on your phone.** Initial scaffolding is way faster on a real keyboard.
2. **Speech-to-text is your real keyboard.** Dictate prompts. Don't peck.
3. **The compute lives somewhere else.** Claude Code isn't an iOS app. Every workflow below runs Claude on a remote machine and gives you a phone window into it.

---

## 1. Termius + Tailscale + tmux (the indie classic)

SSH from your phone into your laptop or a cloud VM where Claude Code is installed.

- **Tailscale** creates a secure private network—no port forwarding needed.
- **Termius** is the SSH client with a mobile-friendly key row.
- **tmux** keeps your session alive when you switch apps or lose signal.

Cost: Tailscale free for personal, Termius free tier ($10/mo for sync).

---

## 2. GitHub Codespaces in your phone browser

Spin up a cloud dev environment that runs in any browser. Install Claude Code in the terminal:

```
npm install -g @anthropic-ai/claude-code
claude
```

iPad with a Bluetooth keyboard makes this near-desktop. iPhone is workable but tight.

Cost: 60 free hours/month on GitHub Free.

---

## 3. The Claude Code GitHub Action (issue-to-PR from anywhere)

Tag `@claude` in a GitHub issue or PR comment. Claude opens (or updates) a PR in the background. Best workflow when you don't want to *watch* Claude work.

One-time setup: in your terminal run `claude`, then `/install-github-app`.

Then from the GitHub mobile app: open an issue saying "@claude the signup form crashes when email is empty. Fix it and add a test." A few minutes later, PR appears.

Cost: a few cents per fix in API credits.

---

## 4. Catnip (Claude Code on iPhone via Codespaces)

A community-built iOS shell that runs Claude Code in a Codespace under the hood, with a UI built for thumbs. Voice input is the killer feature. Newest of the bunch—rough edges—but the most "just works" iPhone experience today.

---

## Which One Should You Pick?

- **Have a Mac/Linux you can leave on:** Termius + Tailscale + tmux.
- **Main device is iPad:** GitHub Codespaces in Safari + Bluetooth keyboard.
- **Mostly want to dispatch fixes async:** Claude Code GitHub Action.
- **iPhone only:** Catnip first, Codespaces in Safari as fallback.

---

## Five Habits That Make Mobile Building Work

1. Dictate, don't type.
2. Set up shell snippets in Termius.
3. Always run inside tmux.
4. Keep prompts short.
5. Use plan mode for anything risky.

---

## Want this set up on your phone in 30 minutes?

Book a 1:1 with John. We'll set up Termius + Tailscale + tmux (or your preferred stack) on your laptop and phone, install Claude Code, and confirm it works end-to-end while we're on the call. For founders who'd rather skip the SSH-key debugging detour.

**[Book a Claude Code Setup Session →](https://cal.com/switchtoux/mvp-sprint)**

---

**[Browse Startup Ideas →](https://weekendmvp.app/startup-ideas.html)**
