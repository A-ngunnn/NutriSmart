/**
 * Test Auth Mode - สำหรับทดสอบ Backend API โดยไม่ต้อง Supabase
 * ใช้ temporary user ID เพื่อเทสต์
 */

export const TEST_USER_ID = "test-user-001";

export function isTestMode(): boolean {
  return process.env.NEXT_PUBLIC_TEST_MODE === "true";
}

export function getTestUserId(): string {
  return TEST_USER_ID;
}

// Mock user data for testing
export const mockUser = {
  id: TEST_USER_ID,
  email: "test@nutrismart.app",
  name: "ผู้ทดสอบ",
  created_at: new Date().toISOString(),
};

// Simulate user session in test mode
export function getTestSession() {
  return isTestMode()
    ? {
        user: mockUser,
      }
    : null;
}
