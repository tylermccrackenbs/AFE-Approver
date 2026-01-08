// Simplified auth - no authentication required for now
// Mock user for development

// For testing, use Tyler McCracken as the current user
// Change this to test different user scenarios
export const MOCK_USER = {
  id: "92453799-ad70-4472-9b87-2121ad0e1570",
  name: "Tyler McCracken",
  email: "tyler.mccracken@blackswanog.com",
  role: "ADMIN" as const,
};

// Helper to get current user (returns mock user for now)
export function getCurrentUser() {
  return MOCK_USER;
}

// Helper to check if user is admin
export function isAdmin(user: typeof MOCK_USER | null) {
  return user?.role === "ADMIN";
}
