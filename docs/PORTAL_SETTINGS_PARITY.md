# Portal Settings Parity Runbook

## Scope

This runbook validates the `/portal/settings` parity implementation:

- Unified settings shell and module navigation
- Database-backed modules (operating hours, channels, macros, workflows, SLA, chat page, translation overrides)
- Runtime behavior wiring (off-hours auto reply, workflow triggers, SLA status in inbox)
- Cross-module consistency guard endpoint

## API Endpoints

- `GET/PUT /portal/settings/operating-hours`
- `GET/PUT /portal/settings/channels`
- `GET/POST /portal/settings/macros`
- `PUT/DELETE /portal/settings/macros/:id`
- `GET/POST /portal/settings/workflows`
- `PUT/DELETE /portal/settings/workflows/:id`
- `GET/PUT /portal/settings/sla`
- `GET/PUT /portal/settings/chat-page`
- `GET/PUT/DELETE /portal/settings/translations`
- `GET /portal/settings/consistency`

## Validation Matrix

1. Settings shell
   - Open `/portal/settings`
   - Verify sidebar navigation and module cards render
   - Verify consistency panel is visible

2. Operating hours
   - Enable operating hours and set weekdays
   - Enable off-hours auto reply and save text
   - Send widget message outside configured hours and verify off-hours reply is created

3. Channels
   - Toggle each channel on/off
   - Refresh page and verify persisted values

4. Macros
   - Create a macro
   - Verify macro appears in list
   - Delete macro and verify removal

5. Workflows
   - Create workflow with trigger `message_created` and `autoReplyText`
   - Send widget user message and verify automated assistant reply is inserted

6. SLA
   - Enable SLA policy and set thresholds
   - Open inbox list and verify `ok|warning|breached` badge appears on open conversations

7. Chat page config
   - Update title/subtitle/placeholder
   - Verify `GET /api/bootloader` response includes `config.chatPageConfig`

8. Translation overrides
   - Add override for `tr` locale and a key
   - Verify list endpoint returns override
   - Delete override and verify removal

9. Consistency guards
   - Create invalid setup (e.g. enable operating hours with no open day)
   - Verify `/portal/settings/consistency` reports an issue

## Commands Executed

- `pnpm --filter @helvino/api db:push`
- `pnpm --filter @helvino/api build`

`pnpm --filter web build` currently reports unrelated pre-existing lint/type issues outside this scope; module-specific lint checks for edited files are clean.
