import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Get the current session on the server
export async function getSession() {
  return await getServerSession(authOptions);
}

// Get the current user from session
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

// Check if user is admin
export function isAdmin(user: { role?: string } | null) {
  return user?.role === "ADMIN";
}

// For backwards compatibility during migration - remove after full migration
export const MOCK_USER = {
  id: "92453799-ad70-4472-9b87-2121ad0e1570",
  name: "Tyler McCracken",
  email: "tyler.mccracken@blackswanog.com",
  role: "ADMIN" as const,
};
