import { auth } from "@clerk/nextjs/server";

// Admin emails that have full access
const ADMIN_EMAILS = [
  "nishanthkr1409@gmail.com"
];

// Admin user IDs (for backward compatibility)
const ADMIN_IDS = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);

export async function ensureAdmin(): Promise<{ isAdmin: boolean; userEmail?: string; userId?: string }> {
  const { userId } = await auth();
  
  if (!userId) {
    return { isAdmin: false };
  }

  // Check if user ID is in admin list (backward compatibility)
  if (ADMIN_IDS.length > 0 && ADMIN_IDS.includes(userId)) {
    return { isAdmin: true, userId };
  }

  // For email-based admin access, we need to get the user's email
  // Since Clerk doesn't provide email directly in auth(), we'll need to fetch it
  try {
    // Get user data from Clerk
    const clerkResponse = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (clerkResponse.ok) {
      const userData = await clerkResponse.json();
      const userEmail = userData.email_addresses?.[0]?.email_address;
      
      if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
        return { isAdmin: true, userEmail, userId };
      }
    }
  } catch (error) {
    console.error('Error fetching user email from Clerk:', error);
  }

  return { isAdmin: false, userId };
}

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email);
}

export function getAdminEmails(): string[] {
  return [...ADMIN_EMAILS];
}
