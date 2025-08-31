import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware({
  publicRoutes: [
    "/",
    "/sw.js",
    "/favicon.ico",
    "/manifest.json",
  ],
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


