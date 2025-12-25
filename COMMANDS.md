# 🛠️ Development Commands

This file contains a list of frequently used commands for development, database management, and project maintenance.

---

### 🚀 General Development
| Command | Description |
| :--- | :--- |
| `pnpm dev` | Start the Next.js development server. |
| `pnpm build` | Build the application for production. |
| `pnpm start` | Start the production server. |
| `pnpm lint` | Run the linter to check for code quality issues. |
| `pnpm format` | Automatically fix formatting issues. |

### 📂 Helper Scripts
| Command | Description |
| :--- | :--- |
| `npx tsx scripts/fetch_issues.ts` | Fetch and display GitHub issues in a human-readable format. |

### 🗄️ Database Management
| Command | Description |
| :--- | :--- |
| `pnpm db:push` | Push schema changes to the database. |
| `pnpm db:generate` | Generate database migrations. |
| `pnpm db:migrate` | Run database migrations. |
| `pnpm db:studio` | Open Drizzle Studio to visualize and manage data. |
| `pnpm db:pull` | Pull the schema from the database. |
| `pnpm db:check` | Check for schema inconsistencies. |

### 🧪 Testing
| Command | Description |
| :--- | :--- |
| `pnpm test` | Run Playwright end-to-end tests. |

---

> [!TIP]
> Use these commands from the root directory of the project. Make sure you have `pnpm` installed and dependencies updated.