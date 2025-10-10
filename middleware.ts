import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sw.js",
  "/favicon.ico",
  "/manifest.json",
  "/api/ai/(.*)",
  "/api/geo/(.*)",
  "/api/hotels/near",
  "/api/events",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  await auth.protect();
});

export const config = {
  matcher: [
    '/((?!.+\\.[\\w]+$|_next).*)',
    '/(api|trpc)(.*)',
    '/sw.js',
    '/favicon.ico',
    '/manifest.json',
  ],
};


