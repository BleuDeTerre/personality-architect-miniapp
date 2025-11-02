# 🧪 Testing Guide - Personality Architect Mini App

## ✅ Phase 1-3 Features Testing Checklist

### 📋 Quick Test Guide

Run these tests after each deployment to ensure everything works correctly.

---

## 🎯 Goals Management

### Test: `/goals` Page

**Pre-requisites**: Logged in with Farcaster

**Steps**:
1. Navigate to `/goals`
2. **Create goal**:
   - Fill title, target, due date
   - Click "Add Goal"
   - ✅ Verify: Goal appears in list
3. **Edit goal**:
   - Click edit button on a goal
   - Change values
   - ✅ Verify: Changes saved
4. **Toggle status**:
   - Click checkbox to complete/incomplete
   - ✅ Verify: Status updates immediately
5. **Delete goal**:
   - Click delete button
   - ✅ Verify: Goal removed from list

**API endpoints to test**:
```bash
# Get all goals
GET /api/goals

# Create goal
POST /api/goals
Body: { "title": "Test", "target": 100, "due_date": "2025-12-31" }

# Update goal
PUT /api/goals/{id}
Body: { "title": "Updated", "target": 150 }

# Delete goal
DELETE /api/goals/{id}
```

**Expected**: All CRUD operations work, UI updates correctly.

---

## 📊 Streaks Analytics

### Test: `/streaks` Page

**Pre-requisites**: Have at least one habit with logs

**Steps**:
1. Navigate to `/streaks`
2. **Check stats cards**:
   - ✅ Current Streak should show number
   - ✅ Best Streak should show number
   - ✅ Last Activity should show date or "Never"
3. **Check heatmap**:
   - ✅ Green squares appear for days with activity
   - ✅ Intensity varies (green-200 to green-600)
   - ✅ Last 365 days displayed
4. **Filter by habit**:
   - Select a specific habit from dropdown
   - ✅ Verify: Heatmap updates to show only that habit
   - Select "All Habits"
   - ✅ Verify: All habits shown again

**API endpoints to test**:
```bash
# Get streak stats
GET /api/habits/stats

# Get habit streaks
POST /api/habits/streaks
Body: { "ids": ["habit-id-1", "habit-id-2"] }

# Get habit logs
GET /api/habits/logs?from=2024-01-01&to=2024-12-31
```

**Expected**: Stats display correctly, heatmap renders, filtering works.

---

## 🏆 Badge Gallery

### Test: `/profile` Page

**Pre-requisites**: Logged in with Farcaster, have wallet address

**Steps**:
1. Navigate to `/profile`
2. **Check gallery**:
   - ✅ All 10 badges displayed with images
   - ✅ Each badge shows title, description, status
3. **Check eligibility**:
   - ✅ Eligible badges show "Mint" button enabled
   - ✅ Non-eligible show reason in parentheses
   - ✅ Already minted show "✅ Minted"
4. **Test minting**:
   - Click "Mint" on eligible badge
   - ✅ Verify: Button shows "Minting…" while processing
   - ✅ Verify: After success, status changes to "Minted"
5. **Check mint status**:
   - Refresh page
   - ✅ Verify: Badge still shows as minted

**API endpoints to test**:
```bash
# Get mint status
GET /api/mints/status

# Check eligibility
GET /api/mints/eligibility?code=STREAK_7

# Mint badge
POST /api/mints/mint
Body: { "code": "STREAK_7" }
```

**Expected**: All badges display, eligibility works, minting succeeds.

---

## 🤖 AI Insights

### Test: AI-Generated Insights

**Pre-requisites**: Have habits with 7+ days of logs, Pro credits or payment ready

**Test endpoints**:

#### 1. Weekly AI Insight
```bash
POST /api/paid/insight
Authorization: Bearer {token}

Expected: 
{
  "kind": "ai_insight",
  "period": { "start": "...", "end": "..." },
  "metrics": { "completed_total_7d": X, "active_days_7d": Y, "avg_wheel_7d": Z },
  "insight": "AI generated text...",
  "model": "gpt-4o-mini"
}
```
✅ Verify: Real AI text (not placeholder), model specified

#### 2. Habit Review
```bash
POST /api/paid/habit-review
Authorization: Bearer {token}

Expected:
{
  "kind": "habit_review",
  "period": { "start": "...", "end": "..." },
  "habits": [...],
  "note": "AI generated analysis...",
  "model": "gpt-4o-mini"
}
```
✅ Verify: Real AI analysis, not placeholder

#### 3. Weekly Summary
```bash
POST /api/pro/insight/weekly
Authorization: Bearer {token}
Body: { "week_start": "2024-01-01" }

Expected:
{
  "week_start": "...",
  "totals": { "days": 7, "habits_total": X, "completed": Y, "rate_pct": Z },
  "items": [{ "day": "Mon", "completed": N, "total": M }, ...],
  "summary": "AI generated weekly summary...",
  "cachedUntil": "..."
}
```
✅ Verify: Real weekly summary, data from actual logs, saved to weekly_summaries

---

## 📈 Weekly Summaries

### Test: Weekly Summaries Generation

**Pre-requisites**: Have habit logs for at least one week

**Steps**:
1. Generate weekly summary via API
2. **Check database**:
   ```sql
   SELECT * FROM public.weekly_summaries 
   WHERE iso_week = '2024-W01' 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```
   ✅ Verify: Row exists with AI-generated summary

**API endpoints to test**:
```bash
# Pro version (uses credits)
POST /api/pro/insight/weekly
Body: { "week_start": "2024-01-01" }

# Paid version (X402)
POST /api/paid/insight/weekly  
Body: { "week_start": "2024-01-01" }
```

**Expected**: Both generate real summaries and save to database.

---

## 🔧 Badge Eligibility

### Test: All Badge Rules

**Pre-requisites**: Logged in as test user

**SQL test for each badge**:
```sql
-- Replace with your user UUID
SELECT public.badge_eligibility('your-user-id'::uuid, 'FIRST_LOG');
SELECT public.badge_eligibility('your-user-id'::uuid, 'STREAK_7');
SELECT public.badge_eligibility('your-user-id'::uuid, 'STREAK_30');
SELECT public.badge_eligibility('your-user-id'::uuid, 'STREAK_60');
SELECT public.badge_eligibility('your-user-id'::uuid, 'STREAK_100');
SELECT public.badge_eligibility('your-user-id'::uuid, 'STREAK_365');
SELECT public.badge_eligibility('your-user-id'::uuid, 'WHEEL_70');
SELECT public.badge_eligibility('your-user-id'::uuid, 'WHEEL_80');
SELECT public.badge_eligibility('your-user-id'::uuid, 'CONSISTENT_21');
SELECT public.badge_eligibility('your-user-id'::uuid, 'SHARE_3');
```

**Expected**: Each returns `{ eligible: true/false, reason: string }`.

---

## 🌐 API Health Checks

### Test: Critical Endpoints

```bash
# Health check
GET /api/health

# Habits list
GET /api/habits/list
Authorization: Bearer {token}

# Today's habits
GET /api/habits/today

# Streaks
POST /api/habits/streaks
Authorization: Bearer {token}
Body: { "ids": ["id1"] }

# Stats
GET /api/habits/stats
Authorization: Bearer {token}
```

✅ Verify: All return 200 OK with valid JSON.

---

## 🐛 Known Issues to Check

1. **Value vs Completed**: Make sure habit_logs uses `value`, not `completed`
2. **Events log**: Verify `name` field (not `event`) when checking shares
3. **RPC functions**: Confirm `habit_streak` and `get_habit_streak` work correctly

---

## 📊 Test Coverage Summary

| Feature | UI Test | API Test | Status |
|---------|---------|----------|--------|
| Goals CRUD | ✅ | ✅ | Pending |
| Streaks Analytics | ✅ | ✅ | Pending |
| Badge Gallery | ✅ | ✅ | Pending |
| AI Insights | ❌ | ✅ | Pending |
| Weekly Summaries | ❌ | ✅ | Pending |
| Badge Eligibility | ❌ | ✅ | Pending |

---

## 🚀 Quick Smoke Test

Run this to verify basic functionality:

1. ✅ Login through Farcaster
2. ✅ Create a goal
3. ✅ View `/streaks` page (stats load)
4. ✅ View `/profile` (badges display)
5. ✅ Check one AI insight endpoint
6. ✅ Mint one eligible badge

If all pass → System is operational! ✅

---

**Last Updated**: After Phase 3 completion
**Deploy Status**: Production ready
**Next Phase**: Phase 4 (Advanced Analytics) or testing
