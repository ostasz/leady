# Security Configuration Guide

## Vercel Cron Jobs

To secure the cron job endpoint `/api/cron/import-email`, you need to set up a `CRON_SECRET` environment variable.

### Setup Instructions:

1. **Generate a secure secret**:
   ```bash
   openssl rand -base64 32
   ```

2. **Add to Vercel Environment Variables**:
   - Go to your Vercel project settings
   - Navigate to "Environment Variables"
   - Add: `CRON_SECRET=<your-generated-secret>`
   - Apply to: Production, Preview, Development

3. **Configure Vercel Cron Job**:
   In your `vercel.json`, the cron job should include the secret in headers:
   ```json
   {
     "crons": [{
       "path": "/api/cron/import-email",
       "schedule": "0 */6 * * *",
       "headers": {
         "authorization": "Bearer <CRON_SECRET>"
       }
     }]
   }
   ```

4. **Local Development**:
   Add to your `.env.local`:
   ```
   CRON_SECRET=your-local-secret-for-testing
   ```

## Testing

### Test authenticated endpoints:
```bash
# Get your Firebase ID token first (from browser DevTools)
TOKEN="your-firebase-id-token"

# Test debug endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:3006/api/debug/futures

# Test cron endpoint
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3006/api/cron/import-email
```

### Expected responses:
- ✅ With valid token: Returns data
- ❌ Without token: `{"error":"Unauthorized"}` (401)
- ❌ Invalid token: `{"error":"Unauthorized - Invalid token"}` (401)

## Security Best Practices

1. **Never commit secrets** to git
2. **Rotate CRON_SECRET** periodically
3. **Monitor 401 errors** in logs for unauthorized access attempts
4. **Use different secrets** for production vs development
