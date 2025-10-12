# Admin Access Setup

## Email-Based Admin Access

The admin system now supports email-based access control. The email `nishanthkr1409@gmail.com` has been granted full admin access.

### How it works:

1. **Email Verification**: When a user logs in, the system fetches their email from Clerk
2. **Admin Check**: The system checks if the email is in the admin emails list
3. **Access Grant**: If the email matches, full admin permissions are granted

### Admin Permissions:

- ✅ **Read Access**: View all events and hotels
- ✅ **Write Access**: Create new events and hotels  
- ✅ **Edit Access**: Update existing events and hotels
- ✅ **Delete Access**: Remove events and hotels

### Admin Emails List:

The admin emails are defined in `lib/admin.ts`:

```typescript
const ADMIN_EMAILS = [
  "nishanthkr1409@gmail.com"
];
```

### Adding More Admins:

To add more admin emails, simply add them to the `ADMIN_EMAILS` array in `lib/admin.ts`.

### Environment Variables:

Make sure you have the following environment variables set:

- `CLERK_SECRET_KEY`: Required for fetching user email from Clerk API
- `FIREBASE_PROJECT_ID`: Required for Firebase admin operations
- `FIREBASE_CLIENT_EMAIL`: Required for Firebase admin operations  
- `FIREBASE_PRIVATE_KEY`: Required for Firebase admin operations

### Backward Compatibility:

The system still supports the old `ADMIN_USER_IDS` environment variable for backward compatibility, but email-based access is now the primary method.
