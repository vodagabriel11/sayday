# sayday

Voice-first AI-powered task management application for reminders, events, and structured notes.

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Express sessions + Passport.js + bcrypt (session store: connect-pg-simple)
- **AI**: OpenAI via Replit AI Integrations (gpt-4o-mini for intent classification, gpt-4o-transcribe for STT)
- **Routing**: wouter (frontend), Express (backend API)
- **State Management**: TanStack React Query

## Key Features

- Voice input (MediaRecorder API -> server-side transcription via AssemblyAI)
- Text input with AI intent classification
- Automatic categorization: Reminder / Event / Note
- AI-generated short titles, dates, tags, structured content, personalized emoji per item
- Today view with hourly timeline, drag-and-drop reordering, compact/expanded toggle
- Calendar month view with day selection and item search
- Notes page with search, tag filtering, and structured content display
- Dark/Light/System theme toggle
- Mobile-first responsive design
- Onboarding slides (3 screens) for first-time users, then auth, then plan selection
- Authentication (email/password signup & login)
- Settings page (account, notifications, appearance, data & privacy)
- Paywall screen with Free/Pro plan comparison
- Plan selection screen (post-registration, choose Free or Pro)
- Feature gating (10 tasks/week for free users, recurring events pro-only)
- Weekly task counter with progress bar

## Project Structure

```
client/src/
  App.tsx               - Main app with routing, auth protection, navigation
  hooks/
    use-auth.ts         - Auth context hook (useAuth)
    use-toast.ts        - Toast notification hook
  lib/
    protected-route.tsx - Route guard for authenticated pages
    queryClient.ts      - TanStack Query setup with auth-aware fetching
    alarm-service.ts    - Local alarm scheduling service
  components/
    theme-provider.tsx  - Light/Dark/System theme context
    voice-button.tsx    - Voice recording button component
    chatbox.tsx         - Full-screen chat panel for viewing/adding items
    item-card.tsx       - Item display card component
    voice-confirmation-sheet.tsx - Bottom sheet for voice recording confirmation
    alarm-overlay.tsx   - Full-screen alarm overlay
    event-detail-sheet.tsx - Event detail bottom sheet
  pages/
    home.tsx            - Home page with voice/text input + weekly task counter
    today.tsx           - Today's items view
    calendar-page.tsx   - Calendar month view
    notes.tsx           - Notes list with search/filter
    note-detail.tsx     - Individual note detail page (markdown rendering via react-markdown, edit/preview toggle, collapsible transcript)
    onboarding.tsx      - 3-slide onboarding intro for new users
    auth-page.tsx       - Login/Signup/Forgot Password page
    plan-selection.tsx  - Post-registration plan picker (Free/Pro)
    settings.tsx        - Full settings page (account, notifications, appearance, etc.)
    paywall.tsx         - Free vs Pro plan comparison & upgrade page
    not-found.tsx       - 404 page

server/
  index.ts    - Express server entry point (with session middleware)
  db.ts       - Database connection (Drizzle + pg)
  auth.ts     - Authentication setup (Passport, sessions, auth routes, profile management)
  routes.ts   - Protected API routes (/api/items, /api/parse-intent, /api/transcribe, /api/reminders)
  storage.ts  - Database storage interface & implementation (users + items + reminders)
  ai.ts       - OpenAI integration (parseIntent, transcribeAudio)
  seed.ts     - Database seed data (disabled)

shared/
  schema.ts   - Drizzle schema (users, items, itemReminders) + Zod types
```

## Database Schema

- `users` - User accounts with auth, subscription plan, notification preferences, appearance settings
- `items` - Unified table for reminders, events, notes (type field distinguishes); userId references users
- `item_reminders` - Reminder configurations per item
- `session` - Express session store (auto-created by connect-pg-simple)

## API Endpoints

### Auth
- `POST /api/auth/register` - Create account (name, email, password)
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user (returns 401 if not authenticated)
- `POST /api/auth/change-password` - Change password (requires current password)
- `PATCH /api/auth/profile` - Update profile fields (name, email, notification prefs, appearance)
- `DELETE /api/auth/account` - Delete account and all data
- `GET /api/auth/weekly-tasks` - Get weekly task count and limit
- `POST /api/auth/export-data` - Export all user data as JSON
- `POST /api/auth/clear-data` - Clear all user items

### Items (all require auth)
- `GET /api/items` - List items (filters: type, date, startDate/endDate) - scoped to user
- `GET /api/items/:id` - Get single item (ownership checked)
- `POST /api/items` - Create item (with feature gating: 10/week limit for free, no recurring for free)
- `PATCH /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item
- `POST /api/items/:id/done` - Mark item as done
- `POST /api/parse-intent` - AI intent classification
- `POST /api/transcribe` - Audio transcription
- `GET /api/items/:id/reminders` - Get reminders
- `POST /api/reminders` - Create reminder
- `PATCH /api/reminders/:id` - Update reminder
- `DELETE /api/reminders/:id` - Delete reminder

## Feature Gating

- Free plan: 10 tasks per week (tracked per user, resets every Monday)
- Pro plan: Unlimited tasks, recurring scheduling
- Weekly task counter shown on home page for free users
- Error responses: `WEEKLY_LIMIT_REACHED` (403) and `PRO_FEATURE` (403)
- Frontend shows toast messages when limits are hit

## Alarm System

- Local alarm scheduling via alarm-service.ts (setTimeout-based)
- AlarmOverlay: full-screen overlay when alarm fires
- AlarmSync component syncs alarms from React Query data
- Capacitor-ready architecture

## Theme

- Primary color: Green (145 63% 42% light / 145 63% 49% dark)
- Supports Light / Dark / System themes
- Accent color picker: green, blue, purple, orange, pink, teal
- Font: Plus Jakarta Sans
- Branding: "saytask." logo with green dot

## Integrations

- OpenAI AI Integrations (blueprint:javascript_openai_ai_integrations) - No API key needed, uses Replit credits
- Stripe connector available but not yet activated (for future Pro subscription payments)
