# 📊 PHASE 3 PRODUCTION: 24-48 Hour Burn-In Monitoring

**Duration:** First 24-48 hours after 2FA goes live  
**Goal:** Identify and resolve issues before they affect users  
**Resources Required:** Terminal, Supabase dashboard, Render logs  

---

## 🎯 MONITORING OBJECTIVES

**Hour 0-1:** Immediate stability check  
**Hour 1-6:** Early issue detection  
**Hour 6-24:** Pattern detection and optimization  
**Hour 24-48:** Sustained stability verification  

---

## 📋 MONITORING DASHBOARD SETUP (5 minutes)

### Open These in Separate Windows:

**Window 1: Render Logs (Live)**
```
https://dashboard.render.com/services/[your-service-id]
→ Logs tab
→ Auto-refresh enabled
→ Tail last 100 lines
```

**Window 2: Supabase Monitoring**
```
Supabase Dashboard
→ SQL Editor
→ Keep these queries saved:

Query 1: Recent audit logs
SELECT action, status, COUNT(*) 
FROM admin_audit_logs
WHERE created_at > now() - interval '1 hour'
GROUP BY action, status
ORDER BY action;

Query 2: 2FA attempt tracking
SELECT COUNT(*) as total_attempts,
       COUNT(CASE WHEN status='failure' THEN 1 END) as failures,
       COUNT(CASE WHEN locked_until > now() THEN 1 END) as locked
FROM (
  SELECT * FROM twofa_attempts
  WHERE updated_at > now() - interval '1 hour'
) t;

Query 3: Error trends
SELECT error, COUNT(*) 
FROM admin_audit_logs
WHERE status = 'failure'
AND created_at > now() - interval '1 hour'
GROUP BY error
ORDER BY COUNT(*) DESC;
```

**Window 3: Terminal (for curl tests)**
```bash
# Commands to run hourly
curl https://your-service.onrender.com/health
curl -X POST https://your-service.onrender.com/api/2fa/verify-login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{"token":"000000"}'  # Test rate limiting
```

---

## ⏰ HOUR 0-1: IMMEDIATE STABILITY CHECK

### What to Watch:

```
[ ] Service status: "live" (not restarting)
[ ] Health endpoint responds: /health → 200 OK
[ ] No "502 Bad Gateway" errors
[ ] No database connection errors
[ ] Logs showing normal startup
```

### Actions:

```bash
# Check service is running
curl https://your-service.onrender.com/health

# Render logs should show:
# Server running on port 3000
# [AUTH] Database connected
# [2FA] Service initialized
# No error messages

# If issues:
# → Check PHASE_3_EMERGENCY_DISABLE.md
```

### Red Flags (STOP if seen):

```
❌ 502 Bad Gateway (service crashed)
❌ Connection refused (port 3000 not listening)
❌ "Cannot connect to database" (Supabase down)
❌ "jwt malformed" (secret issue)
❌ "CORS error" (frontend URL mismatch)
```

### Action if Red Flag:

1. Stop accepting connections (disable in Render)
2. Check Render logs for error
3. Go to PHASE_3_EMERGENCY_DISABLE.md
4. Execute appropriate rollback

---

## 🔍 HOUR 1-6: EARLY ISSUE DETECTION

### Every 30 Minutes:

**Check 1: Login Activity**
```sql
-- Run Query 1: Recent audit logs
SELECT action, status, COUNT(*) 
FROM admin_audit_logs
WHERE created_at > now() - interval '30 minutes'
GROUP BY action, status
ORDER BY action;

-- Expected pattern:
-- LOGIN_SUCCESS | success | ~5-10
-- LOGIN_FAILURE | failure | ~0-2 (should be rare)
-- 2FA_VERIFY_ATTEMPT | success | ~3-5
-- 2FA_VERIFY_ATTEMPT | failure | ~0-2
-- 2FA_LOCKOUT | success | 0 (should not happen unless user mistake)

-- ❌ RED FLAG: More than 1 2FA_LOCKOUT per hour
-- ❌ RED FLAG: LOGIN_FAILURE > 5% of attempts
-- ❌ RED FLAG: 2FA failures > 50% of attempts
```

**Check 2: 2FA Status**
```sql
-- Run Query 2: 2FA attempt tracking
SELECT COUNT(*) as total_attempts,
       COUNT(CASE WHEN status='failure' THEN 1 END) as failures,
       COUNT(CASE WHEN locked_until > now() THEN 1 END) as locked
FROM (
  SELECT * FROM twofa_attempts
  WHERE updated_at > now() - interval '30 minutes'
) t;

-- Expected:
-- total_attempts: 0-5
-- failures: 0-2
-- locked: 0-1

-- ❌ RED FLAG: locked > 2 (multiple users locked out)
-- ❌ RED FLAG: failures > 50% of attempts
```

**Check 3: Error Trends**
```sql
-- Run Query 3: Error trends
SELECT error, COUNT(*) 
FROM admin_audit_logs
WHERE status = 'failure'
AND created_at > now() - interval '30 minutes'
GROUP BY error
ORDER BY COUNT(*) DESC LIMIT 5;

-- Expected: Few or no errors
-- ❌ RED FLAG: Same error appearing >2 times
```

**Check 4: Render Logs**
```
Look for patterns:
✅ [2FA] 2FA verification success
✅ [AUTH] Token verified successfully
✅ [RATE_LIMIT] 3 attempts limit enforced

❌ [2FA] verification failed (should be rare)
❌ [ERROR] Database error
❌ [AUTH] Token verification failed (should be rare)
```

### Issue Pattern Detection:

**Pattern 1: Repeated 2FA Failures**
```
What you see:
- 2FA_VERIFY_ATTEMPT failure appearing >3 times/hour
- Same admin_id locked out multiple times

Likely cause:
- Time sync issue with user's authenticator
- Database encryption issue
- Clock skew between server and client

Action:
- Have user regenerate QR code
- Check system time is correct
- Monitor for more occurrences
```

**Pattern 2: OAuth Issues**
```
What you see:
- LOGIN_FAILURE appearing frequently
- Before 2FA_VERIFY_ATTEMPT (failed auth)

Likely cause:
- JWT token invalid
- CORS blocking
- Supabase auth issue

Action:
- Check CORS settings in Render
- Verify JWT secret matches Supabase
- Check Supabase dashboard for auth errors
```

**Pattern 3: Rate Limiting Too Strict**
```
What you see:
- 2FA_LOCKOUT appearing frequently
- Multiple users locked out in short time
- Only 1-2 wrong attempts before lockout

Likely cause:
- Rate limiter threshold too low
- twofa_attempts table has stale data

Action:
- Check: twofa_attempts table
- Reset stuck records: UPDATE twofa_attempts SET locked_until=NULL WHERE locked_until < now();
- Consider increasing attempt limit from 3 to 5
```

---

## 📈 HOUR 6-24: PATTERN DETECTION

### Every 2 Hours:

**Trend Analysis:**
```sql
-- Overall 2FA adoption/usage
SELECT 
  COUNT(DISTINCT admin_id) as users_with_2fa,
  COUNT(CASE WHEN twofa_enabled=true THEN 1 END) as enabled,
  COUNT(CASE WHEN twofa_enabled=false THEN 1 END) as disabled,
  ROUND(100.0 * COUNT(CASE WHEN twofa_enabled=true THEN 1 END) / COUNT(*), 2) as adoption_pct
FROM admin_users
WHERE role = 'super_admin';

-- Expected: ~50-100% adoption for super_admins
-- ❌ RED FLAG: Low adoption (<30%) might indicate issues
```

**Success Rate Analysis:**
```sql
-- 2FA verification success rate
SELECT 
  COUNT(*) as total_attempts,
  COUNT(CASE WHEN status='success' THEN 1 END) as success,
  COUNT(CASE WHEN status='failure' THEN 1 END) as failure,
  ROUND(100.0 * COUNT(CASE WHEN status='success' THEN 1 END) / COUNT(*), 2) as success_rate
FROM admin_audit_logs
WHERE action = '2FA_VERIFY_ATTEMPT'
AND created_at > now() - interval '6 hours';

-- Expected: >90% success rate
-- ❌ RED FLAG: <80% success rate indicates problems
```

### Key Metrics to Track:

| Metric | Hour 1 | Hour 6 | Hour 24 | Target |
|--------|--------|--------|---------|--------|
| Average login time | ? | ? | ? | <5 sec |
| 2FA verification success % | ? | ? | ? | >95% |
| Lockout events | ? | ? | ? | <5/day |
| Database connections | ? | ? | ? | <50 |
| Error rate | ? | ? | ? | <1% |

### Create Spreadsheet:

```
Time    | Logins | 2FA Success | Lockouts | Errors | Notes
--------|--------|-------------|----------|--------|--------
Hour 1  |   12   |    100%     |    0     |   0    | OK
Hour 2  |   8    |    100%     |    0     |   0    | OK
Hour 6  |   45   |    98%      |    1     |   0    | Normal
Hour 12 |  120   |    96%      |    2     |   1    | 1 auth issue
Hour 24 |  280   |    95%      |    4     |   2    | Stable
```

---

## 🎯 HOUR 24-48: SUSTAINED STABILITY VERIFICATION

### Daily Health Check:

```bash
# Day 2 at same time as deployment
# Full end-to-end test

# Test 1: Can login with 2FA
# Test 2: Can login without 2FA
# Test 3: Rate limiting works
# Test 4: Non-admins bypass
# Test 5: Protected routes work
```

**Expected Results:**
```
✅ All 5 tests pass
✅ No errors in logs
✅ Database clean
✅ Performance acceptable
✅ No mysterious errors
```

### Success Criteria for 48-Hour Period:

```
[ ] No unplanned downtime (502 errors)
[ ] No repeated authentication failures
[ ] No unusual rate limiting events
[ ] No database connection errors
[ ] No JWT/security issues
[ ] All users able to login successfully
[ ] 2FA verification works >95% of time
[ ] Audit logs show expected patterns
[ ] Performance metrics stable
[ ] No escalating error trends
```

---

## ⚠️ WHAT TO WATCH FOR (Red Flags)

### Critical Issues (STOP immediately):

```
❌ 502 Bad Gateway (service down)
   → Check Render logs
   → Restart service if needed
   → If persists: EMERGENCY_DISABLE

❌ Database connection errors
   → Check Supabase status
   → Check SUPABASE_URL and credentials
   → Verify database permissions

❌ JWT token errors on valid tokens
   → Check SUPABASE_JWT_SECRET
   → Verify it matches Supabase
   → Check token expiry

❌ 2FA completely broken (0% success rate)
   → Likely middleware order wrong
   → Or require2FA not attached correctly
   → EMERGENCY_DISABLE and verify code
```

### Warnings (Monitor closely):

```
⚠️ 2FA success rate dropping below 90%
   → Investigate failed attempts
   → Check authenticator app sync
   → Monitor for patterns

⚠️ Multiple lockouts in short time
   → Check if users are retrying too fast
   → May indicate usability issue
   → Consider increasing attempt threshold

⚠️ CORS errors appearing
   → Likely frontend URL mismatch
   → Verify FRONTEND_ORIGIN in Render
   → Clear browser cache

⚠️ Rate limiting too aggressive
   → Users getting locked out unnecessarily
   → May need tuning
   → Document issues for adjustment
```

### Observations (Note for future):

```
ℹ️ Performance slower than expected
   → Expected: <2 sec for 2FA verification
   → If >5 sec: May need optimization
   → But not urgent

ℹ️ Non-super-admins questioning 2FA
   → Educate about security benefit
   → Ensure they understand it's required
   → Not a technical issue

ℹ️ Audit logs showing expected events
   → Means logging is working
   → Good for compliance
   → Keep logs for audit trail
```

---

## 📞 ESCALATION FLOW

### Tier 1: Expected & Normal

```
Event: 2FA_LOCKOUT after 3 failed attempts
Action: Monitor for patterns, no action needed
Status: Normal operation
```

### Tier 2: Unusual But Recoverable

```
Event: 2FA_VERIFY_ATTEMPT failure (1-2/hour)
Action: Check user's authenticator time sync
Status: Monitor, may request user to re-enable 2FA
```

### Tier 3: Problematic

```
Event: >10% 2FA verification failures
Action: Investigate error patterns, review logs
Status: Needs debugging, may need to disable 2FA temporarily
```

### Tier 4: Critical

```
Event: Service error/crash, database connection lost
Action: Immediate EMERGENCY_DISABLE
Status: Rollback to pre-2FA state, investigate
```

---

## 📋 MONITORING CHECKLIST

### Hour 1:
```
[ ] Service is live
[ ] Health endpoint responds
[ ] No 502 errors
[ ] Database connected
[ ] Can login with 2FA
[ ] Audit logs show entries
```

### Hour 6:
```
[ ] Consistent login success
[ ] 2FA verification working
[ ] No error patterns emerging
[ ] Rate limiting functioning
[ ] Database healthy
```

### Hour 24:
```
[ ] Sustained stability
[ ] No unexpected errors
[ ] Performance acceptable
[ ] Audit logs clean
[ ] All systems nominal
[ ] Ready to consider stable
```

### Hour 48:
```
[ ] Double-verify all checks from hour 24
[ ] Confirm no new error patterns
[ ] Performance metrics stable
[ ] Security posture strong
[ ] Ready to declare STABLE
```

---

## 🎯 SUCCESS DECLARATION

**2FA is STABLE when:**

```
✅ 48+ hours have passed
✅ Zero unplanned downtime
✅ Zero critical errors
✅ Login success rate >95%
✅ 2FA verification success rate >95%
✅ No repeated auth issues
✅ Database clean and responsive
✅ Audit logs show expected patterns
✅ No rollback needed
✅ All 5 post-deploy tests still pass
```

**When stable:**
- Remove emergency disable procedures from alert
- Adjust monitoring to standard cadence
- Document any lessons learned
- Consider next phase (Phase 4: Recovery Codes)

---

## 📊 MONITORING TOOLS & COMMANDS

### Quick Health Check (Run hourly):
```bash
# Service health
curl https://your-service.onrender.com/health

# Database connectivity
# (via Supabase console - should be instant)

# Recent errors (copy query to Supabase)
SELECT COUNT(*) FROM admin_audit_logs 
WHERE status='failure' AND created_at > now() - interval '1 hour';

# Locked users
SELECT COUNT(*) FROM twofa_attempts 
WHERE locked_until > now();
```

### Weekly Summary Query:
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_events,
  COUNT(CASE WHEN action LIKE '2FA%' THEN 1 END) as twofa_events,
  COUNT(CASE WHEN status='failure' THEN 1 END) as failures,
  ROUND(100.0 * COUNT(CASE WHEN status='success' THEN 1 END) / COUNT(*), 2) as success_rate
FROM admin_audit_logs
WHERE created_at > now() - interval '7 days'
GROUP BY DATE(created_at)
ORDER BY date;
```

---

## 🔄 IF ISSUES ARE FOUND

### Immediate Response:

1. **Identify Severity:**
   - Critical (service down): Go to PHASE_3_EMERGENCY_DISABLE.md
   - Major (widespread failures): Consider disabling 2FA
   - Minor (isolated issues): Monitor and document

2. **Contain Issue:**
   - Disable for affected users only if possible
   - Or disable globally if widespread
   - Notify users of temporary unavailability

3. **Investigate:**
   - Review Render logs
   - Check database state
   - Identify root cause
   - Plan fix

4. **Communicate:**
   - Document what went wrong
   - Notify stakeholders
   - Provide timeline for resolution

---

**Monitor continuously. Stay alert for red flags. When 48 hours stable: Declare success!**
