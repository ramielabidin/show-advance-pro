

# Google Sign-In + Team-Based Access Control

## The Problem
Right now, anyone who signs up gets access to all your Juice band data. We need two things:
1. **Google sign-in** for convenience
2. **Team-based access** so only people you invite can see your data

## How It Works

You'll be the owner of a "team" (e.g., "Juice"). You can invite people by email. When someone signs in (via Google or email), they only see data belonging to teams they're a member of. If they're not on any team, they see an empty state.

## Plan

### 1. Add Google Sign-In
- Use Lovable Cloud's managed Google OAuth (no API keys needed)
- Add a "Sign in with Google" button to the auth page

### 2. Create Teams + Membership Tables (Migration)
```
teams: id, name, created_by (user id), created_at
team_members: id, team_id, user_id, role (owner/member), created_at
team_invites: id, team_id, email, invited_by, created_at
```

### 3. Link Data to Teams
- Add `team_id` column to: `shows`, `tours`, `touring_party_members`, `app_settings`
- `schedule_entries` and `show_party_members` are linked through `shows`, so they're covered transitively

### 4. Update RLS Policies
Replace the current "any authenticated user" policies with team-scoped policies:
- A `is_team_member(user_id, team_id)` security definer function
- Each table's policy checks that the row's `team_id` matches a team the user belongs to

### 5. Team Management UI
- After login, if user has no team → show "Create Team" or "Waiting for invite" screen
- Settings page gets a "Team" section: view members, invite by email, remove members
- Owner can invite new members by email address

### 6. Auto-Assign Team on Data Creation
- When creating shows, tours, etc., automatically set `team_id` to the user's current team
- Update all insert/create operations across the app

### 7. Invite Flow
- Owner enters an email in Settings → Team section
- An invite row is created; when that person signs up/logs in with that email, they're auto-added to the team

## What You'll Experience
- Sign in with Google (one click)
- First time: create your "Juice" team
- Invite your crew by email
- Only team members see your shows, tours, and settings
- Existing data will need a one-time migration to assign it to your team

