export const PUBLIC_ROUTES = ["/login", "/register", "/otp", "/forgot", "/reset", "/admin/login"];

// Routes that match patterns (for dynamic routes like /post/[id])
export const PUBLIC_ROUTE_PATTERNS = [
    /^\/post\/[^/]+$/, // Matches /post/:id
];

// Helper function to check if a path is public
export const isPublicRoute = (pathname: string): boolean => {
    // Check exact matches
    if (PUBLIC_ROUTES.includes(pathname)) {
        return true;
    }
    
    // Check pattern matches
    return PUBLIC_ROUTE_PATTERNS.some(pattern => pattern.test(pathname));
};
