import { vi } from "vitest";

// Mock Next.js server-only module
vi.mock("server-only", () => ({}));

// Mock environment variables
process.env.AUTH_SECRET = "test-secret-key-for-unit-tests";
process.env.POSTGRES_URL = "postgresql://test:test@localhost:5432/test";
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.EMAIL_DRY_RUN = "true";

// Mock next-auth
vi.mock("next-auth", () => ({
  default: vi.fn(),
}));

// Mock drizzle DB calls globally so tests don't need a real DB
vi.mock("@/lib/db/queries", () => ({
  saveChat: vi.fn().mockResolvedValue({}),
  saveMessages: vi.fn().mockResolvedValue({}),
  getChatById: vi.fn().mockResolvedValue(null),
  getMessagesByChatId: vi.fn().mockResolvedValue([]),
  voteMessage: vi.fn().mockResolvedValue({}),
  getUserByEmail: vi.fn().mockResolvedValue(null),
  createUser: vi.fn().mockResolvedValue({ id: "user-1", email: "test@test.com" }),
}));
