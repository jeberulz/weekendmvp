---
slug: "ai-podcast-clipper"
title: "AI Podcast Clip Generator"
---

## The Problem

Podcasters record 1-2 hour episodes but struggle to promote them. The best content is buried in hour-long recordings. Manually scrubbing through audio to find clip-worthy moments takes forever. Most podcasters never repurpose their content, missing huge audience growth opportunities.

## The Solution

Upload a podcast episode, AI transcribes it, identifies the most engaging 30-90 second segments, and generates shareable video clips with auto-generated captions. Export ready for TikTok, Instagram Reels, and YouTube Shorts.

**How it works:**

1. **Upload episode** — Audio or video file
2. **AI finds highlights** — Best moments detected
3. **Export clips** — With captions, ready to post

## Market Research

- Opus Clip, Descript prove demand for AI video editing
- 5M+ podcasts globally—massive TAM
- Short-form video is primary discovery channel

## AI Prompts to Build This

**1. Project Setup**

```text
Create a Next.js app for podcast clip generation.

Features:
- Dashboard: uploaded episodes, generated clips
- Upload: audio/video files up to 2GB
- Processing status: transcription progress, clip detection status
- Clip editor: trim, adjust, preview
- Export: download clips in multiple formats

Use Supabase for auth. Mux or Cloudflare for video processing.
```

**2. Highlight Detection**

```text
Build the AI highlight finder:

1. Transcribe audio using Whisper API (with timestamps)
2. Send transcript to Claude with prompt:
   "Find the 5 most engaging, shareable moments in this podcast. Look for: surprising statements, emotional moments, actionable advice, controversial takes, funny exchanges. Return timestamp ranges and why each is clip-worthy."
3. Extract those segments from original audio/video
4. Rank by predicted engagement

Let users mark favorites and reject unwanted suggestions.
```

**3. Clip Generation**

```text
Create the video clip with captions:

1. Extract clip segment from source
2. Generate word-level captions from transcript
3. Apply caption style: animated word highlighting, emoji reactions
4. Add branding: logo watermark, podcast name
5. Format for platform: 9:16 for TikTok/Reels, 1:1 for Instagram
6. Render using FFmpeg or Remotion

Templates: choose from pre-designed caption styles and layouts.
```
