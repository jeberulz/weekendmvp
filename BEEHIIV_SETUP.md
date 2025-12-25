# Beehiiv Integration Setup Guide

The form now uses **Beehiiv's API V2** via an **Edge Function** to reliably add subscribers and trigger your automation workflow. This is the fastest and most reliable method.

## ⚡ Quick Start (Vercel - Recommended)

1. **Get your Beehiiv API Key:**
   - Go to Beehiiv Dashboard → **Settings** → **API**
   - Click **"Create New API Key"**
   - Copy the key (you won't see it again!)

2. **Deploy to Vercel:**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login and deploy
   vercel login
   vercel
   ```

3. **Add Environment Variable:**
   - Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
   - Add: `BEEHIIV_API_KEY` = `your-api-key-here`
   - **Important:** Select "Production", "Preview", and "Development"
   - Click **Save**
   - Go to **Deployments** tab → Click **"Redeploy"** on latest deployment

4. **Test:**
   - Open your deployed site
   - Open browser DevTools (F12) → **Console** tab
   - Submit the form
   - Check for any errors in console
   - Check Beehiiv dashboard for new subscriber

## Quick Setup (Choose One)

### Option 1: Deploy to Vercel (Recommended - Easiest)

1. **Get your Beehiiv API Key:**
   - Go to Beehiiv Dashboard → Settings → API
   - Click "Create New API Key"
   - Copy the key

2. **Deploy to Vercel:**
   ```bash
   # Install Vercel CLI if you haven't
   npm i -g vercel
   
   # Deploy
   vercel
   ```

3. **Add Environment Variable:**
   - In Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `BEEHIIV_API_KEY` = `your-api-key-here`
   - Redeploy

4. **Test:**
   - Your form should now work at `https://your-project.vercel.app`
   - Submissions will appear in Beehiiv and trigger your automation

### Option 2: Deploy to Netlify

1. **Get your Beehiiv API Key** (same as above)

2. **Deploy to Netlify:**
   ```bash
   # Install Netlify CLI if you haven't
   npm i -g netlify-cli
   
   # Deploy
   netlify deploy --prod
   ```

3. **Add Environment Variable:**
   - In Netlify Dashboard → Site Settings → Environment Variables
   - Add: `BEEHIIV_API_KEY` = `your-api-key-here`
   - Redeploy

### Option 3: Use Any Other Serverless Platform

The `api/subscribe.js` file can be adapted for:
- AWS Lambda
- Google Cloud Functions
- Azure Functions
- Any Node.js server

Just ensure:
- It accepts POST requests
- It has access to `process.env.BEEHIIV_API_KEY`
- It returns JSON responses

## How It Works

1. User fills out the form in the modal
2. JavaScript sends data to `/api/subscribe`
3. Serverless function calls Beehiiv API V2 with your API key
4. Subscriber is added via the specific form (which triggers your automation)
5. Success message is shown to the user

## 🔍 Troubleshooting

### Form Submissions Not Working

**1. Check Browser Console:**
   - Open DevTools (F12) → **Console** tab
   - Submit form and look for errors
   - Common errors:
     - `404 Not Found` → API endpoint not deployed
     - `500 Internal Server Error` → API key missing or wrong
     - `401 Unauthorized` → Invalid API key

**2. Check Network Tab:**
   - Open DevTools → **Network** tab
   - Submit form
   - Look for `/api/subscribe` request
   - Click it → Check **Response** tab for error details

**3. Verify API Key:**
   ```bash
   # Test your API key (replace YOUR_KEY)
   curl -X GET "https://api.beehiiv.com/v2/publications/pub_5fbc631f-7950-4bac-80fe-80ba70dae2da" \
     -H "Authorization: Bearer YOUR_KEY"
   ```
   Should return publication details, not 401 error.

**4. Check Vercel Function Logs:**
   - Vercel Dashboard → Your Project → **Functions** tab
   - Click on `/api/subscribe`
   - Check **Logs** for errors

### Subscribers Not Appearing in Beehiiv

**Possible Causes:**
- ✅ **Double Opt-In Enabled:** Subscribers must confirm email first
  - Check: Beehiiv → Settings → Publication Settings → Email Confirmation
  - Solution: Either disable double opt-in OR wait for confirmation email
  
- ✅ **API Key Wrong:** Test with curl command above
  
- ✅ **Wrong Publication ID:** Verify in Beehiiv → Settings → API

### Automation Not Triggering

**Check These:**
1. **Automation is Published:**
   - Beehiiv → Automations → "weekend mvp automation"
   - Status should be **"Live"** (green), not "Draft"

2. **Trigger is Correct:**
   - Automation trigger should be: **"Email Submitted"**
   - Form filter should match: `7346f13f-9331-48d7-97f8-88c38da780b1`

3. **Test the Automation:**
   - Manually add a test subscriber in Beehiiv
   - See if automation triggers
   - If yes → form submission issue
   - If no → automation setup issue

### Fallback Method (If API Still Fails)

The form automatically falls back to Beehiiv's embed iframe method if the API endpoint fails. This is less reliable but works without a backend.

**To force fallback:**
- Temporarily rename `/api/subscribe` endpoint
- Form will automatically use embed method

## Testing Locally

If you want to test locally before deploying:

1. Install dependencies (if needed):
   ```bash
   npm install
   ```

2. Use a tool like `vercel dev` or `netlify dev` to run the serverless function locally

3. Update `scripts.js` line 89 to point to your local endpoint:
   ```javascript
   const response = await fetch('http://localhost:3000/api/subscribe', {
   ```

## Security Notes

- ✅ API key is stored server-side only (never exposed to frontend)
- ✅ Form validation happens on both client and server
- ✅ CORS is properly configured
- ✅ Error handling prevents API key leakage

