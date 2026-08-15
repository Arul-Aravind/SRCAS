export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = "admin@123";
export const ADMIN_SESSION_KEY = "luminaxr.adminAuthenticated";

export function validateAdminCredentials(username: string, password: string) {
  return username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}
