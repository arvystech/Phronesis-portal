# CBT Backend Integration Guide

> **Updated access flow:** The current product uses admission number only, without student login. The attached backend contract described JWT-only student access and is superseded for this flow by [CBT-ID-ACCESS-CONTRACT.md](CBT-ID-ACCESS-CONTRACT.md). The backend must expose the candidate access and exam routes described there.


This guide describes the backend needed to move the Phronesis CBT prototype from browser-only storage to a shared, secure system. It covers admin question management, student access by admission number, timed exams, answer saving, and final submission.

The project currently has two browser applications:

- Admin CBT question management: `/admin/cbt`
- Student exam portal: `/cbt`

The current prototype stores question sets and submissions in `localStorage`, and the active attempt in `sessionStorage`. Browser storage is useful for the UI prototype, but it is not shared between devices and must not be treated as trusted exam data. The backend must become the source of truth for exam data, time limits, identity checks, answers, and scores.

## 1. Recommended architecture

Keep the existing admin and student pages. Add a CBT API to the backend that already serves the school's admin API, and call it through the existing same-origin `/api-proxy` in local development. In production, use the same origin or a server-side reverse proxy where possible.

Recommended responsibilities:

- **Admin browser:** manage draft and published exams; never decide whether a user is an admin.
- **Student browser:** display the exam, record selected answers, and show the timer; never decide whether an attempt is in time or calculate the official score.
- **Backend:** authenticate admins, resolve student IDs, enforce class eligibility and exam availability, start and time attempts, store answers, score, submit, and retain an audit trail.
- **Database:** store question sets, question options, exam versions, attempts, answers, and submission state.

Use the school's existing student, class, subject, and admin tables if they exist. Avoid creating parallel student or class records just for CBT.

## 2. Exam and question lifecycle

A question set in the current UI maps naturally to an **exam** assigned to one class and one subject. A useful exam lifecycle is:

1. **Draft:** admins can create and edit questions; students cannot access it.
2. **Published / scheduled:** exam is available only to its assigned class and within its configured availability window.
3. **Closed:** no new attempts can start. Attempts already in progress may finish according to school policy.
4. **Archived:** retained for results and audit; hidden from normal active-exam lists.

An exam should have a stable ID, a title or label, class, subject, academic session/term, duration, availability window, status, and creator/updater metadata. The current interface displays class and subject as the exam title; adding a human-friendly title later is optional.

Each objective question must have exactly four options (`A`, `B`, `C`, `D`) and exactly one correct option. The correct option must be stored privately on the server. Never include it in a response sent to the student browser.

When an exam is published, create an immutable version or snapshot. If an admin edits the source exam while students have attempts, active attempts must keep using the version they started with. Either reject edits while attempts are active or publish edits as a new version. Do not let a question edit silently change an exam already being taken.

## 3. Data model

These are logical entities; map them to the existing database naming conventions. The SQL types below are PostgreSQL-oriented examples.

### `cbt_exams`

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `title` | Optional display name |
| `class_id` | Foreign key to the school's class table |
| `subject_id` | Foreign key to the school's subject table |
| `academic_session_id` | Session/term association, if present |
| `duration_seconds` | Server-owned duration; use `1800` for the requested 30 minutes |
| `status` | `draft`, `scheduled`, `published`, `closed`, `archived` |
| `available_from`, `available_until` | Optional start/end timestamps, stored in UTC |
| `version` | Incremented or snapshot version identifier |
| `created_by`, `updated_by` | Admin foreign keys |
| `created_at`, `updated_at`, `published_at` | Audit timestamps |

### `cbt_questions` and `cbt_options`

A question belongs to an exam version and has `id`, `exam_id`, `exam_version`, `position`, `prompt`, and timestamps. Each option has `id`, `question_id`, `label`, `text`, and `is_correct`. Add a database constraint/transactional validation so each question has exactly four options with distinct labels A–D and exactly one correct option. If questions are snapshotted per exam version, key them by `(exam_id, exam_version)`.

The current browser format is approximately:

```json
{
  "className": "Primary 5",
  "subject": "Mathematics",
  "questions": [
    {
      "prompt": "What is 2 + 2?",
      "options": { "A": "3", "B": "4", "C": "5", "D": "6" },
      "correctOption": "B"
    }
  ]
}
```

Treat that as an input format only. Normalize it into exam, question, and option records. The student API must return option IDs/labels/text, but omit `is_correct` and `correctOption` entirely.

### `cbt_attempts`

Store one row per student attempt:

- `id` UUID primary key
- `student_id`, `exam_id`, and `exam_version`
- `status`: `in_progress`, `submitted`, `auto_submitted`, `expired`, or `voided`
- `started_at`, `expires_at`, `submitted_at` in UTC
- `last_activity_at`
- `submission_reason` such as `student` or `time_limit`
- `score`, `max_score`, and `graded_at` (or a separate result table)
- optional client metadata required for support/audit, avoiding unnecessary personal data

Add a uniqueness rule matching school policy. If only one attempt is allowed, enforce one non-voided attempt per `(student_id, exam_id)`. If retakes are allowed, include an attempt number and enforce the allowed maximum in a transaction.

### `cbt_attempt_answers`

Store `attempt_id`, `question_id` (or snapshot question ID), `selected_option_id` nullable, and `updated_at`. Enforce one answer per question per attempt. A missing answer is unanswered and scores as incorrect unless school policy says otherwise.

For strong historical consistency, snapshot question text and option text into attempt-question records when the attempt starts, or retain immutable exam versions permanently. This protects attempt history if admins later edit or archive the source exam.

## 4. API contract

Use JSON, UTC ISO-8601 timestamps, UUIDs, consistent status codes, and a common error shape. Prefix routes with `/api/v1`. Route names can be adapted to the existing backend, but keep the security behavior described here.

### Admin routes

All `/api/v1/admin/cbt/*` routes require the existing admin session and an explicit authorization check for the required role/permission.

| Method and route | Purpose |
|---|---|
| `GET /api/v1/admin/cbt/exams` | Paginated exam list; filter by class, subject, status, session |
| `POST /api/v1/admin/cbt/exams` | Create a draft exam with questions |
| `GET /api/v1/admin/cbt/exams/:examId` | Get exam details including correct options for authorized admins |
| `PUT /api/v1/admin/cbt/exams/:examId` | Replace/update a draft exam and its questions transactionally |
| `POST /api/v1/admin/cbt/exams/:examId/publish` | Validate and publish a new immutable version |
| `POST /api/v1/admin/cbt/exams/:examId/close` | Stop new attempts |
| `DELETE /api/v1/admin/cbt/exams/:examId` | Prefer archive; hard delete only when no attempts/results refer to it |
| `GET /api/v1/admin/cbt/exams/:examId/attempts` | Paginated attempt/result list, with filters |
| `GET /api/v1/admin/cbt/attempts/:attemptId` | Authorized review of one attempt, including its submitted answers and grading |

Example create request:

```json
{
  "title": "Mid-term Mathematics",
  "classId": "class-uuid",
  "subjectId": "subject-uuid",
  "academicSessionId": "session-uuid",
  "durationSeconds": 1800,
  "availableFrom": "2026-11-20T08:00:00Z",
  "availableUntil": "2026-11-20T16:00:00Z",
  "questions": [
    {
      "prompt": "What is 2 + 2?",
      "options": [
        { "label": "A", "text": "3" },
        { "label": "B", "text": "4", "isCorrect": true },
        { "label": "C", "text": "5" },
        { "label": "D", "text": "6" }
      ]
    }
  ]
}
```

The server should reject an exam with missing class/subject, invalid duration, empty prompts/options, duplicate option labels, anything other than four options, zero or multiple correct options, or an invalid availability range. Use a database transaction so a failed question update cannot leave a half-written exam.

### Student access and exam routes

Student routes must not require admin credentials. They must require a validated student/exam context and enforce the student's class assignment on every request.

| Method and route | Purpose |
|---|---|
| `POST /api/v1/cbt/access` | Resolve a student ID and return only exams that student may take |
| `POST /api/v1/cbt/attempts` | Start an attempt for an eligible exam; server creates start and expiry timestamps |
| `GET /api/v1/cbt/attempts/:attemptId` | Resume an active attempt and return unanswered/answered state and remaining server time |
| `PUT /api/v1/cbt/attempts/:attemptId/answers/:questionId` | Save or replace one selected option |
| `POST /api/v1/cbt/attempts/:attemptId/submit` | Finalize the attempt; idempotent and authoritative |

#### Student access

Request:

```json
{ "studentId": "PSSE/2026/001" }
```

Response should contain a safe candidate summary (`studentId`, display name if policy permits, class) and eligible exams (ID, title, class, subject, question count, availability/status). Do not return questions or correct answers at this stage. Return a generic failure message for an unknown ID rather than disclosing whether a particular student exists.

**Security decision:** a unique ID identifies a student but is not a secret. If possession of the ID is not enough proof of identity for the school, require a second factor such as an exam PIN, one-time code, or authenticated student account. Even if the school chooses ID-only access, rate-limit attempts, bind the attempt to the resolved student record and eligible class, and log rejected attempts.

#### Start an attempt

Request:

```json
{ "examId": "exam-uuid" }
```

Response:

```json
{
  "attemptId": "attempt-uuid",
  "status": "in_progress",
  "startedAt": "2026-11-20T08:05:00Z",
  "expiresAt": "2026-11-20T08:35:00Z",
  "serverTime": "2026-11-20T08:05:00Z",
  "exam": {
    "id": "exam-uuid",
    "title": "Mid-term Mathematics",
    "class": "Primary 5",
    "subject": "Mathematics",
    "durationSeconds": 1800,
    "questions": [
      {
        "id": "question-uuid",
        "position": 1,
        "prompt": "What is 2 + 2?",
        "options": [
          { "id": "option-a-uuid", "label": "A", "text": "3" },
          { "id": "option-b-uuid", "label": "B", "text": "4" },
          { "id": "option-c-uuid", "label": "C", "text": "5" },
          { "id": "option-d-uuid", "label": "D", "text": "6" }
        ]
      }
    ]
  }
}
```

The response must omit correctness flags. Avoid exposing sequential database IDs if they make enumeration easier; UUIDs or opaque IDs are suitable. Never accept a client-provided `startedAt`, `expiresAt`, `durationSeconds`, class, or student ID as authority. Derive them from the authenticated/validated context and exam record.

#### Save an answer

Request:

```json
{ "optionId": "option-b-uuid" }
```

The server verifies that the attempt belongs to the current student, is still `in_progress`, has not expired, and the option belongs to the stated question in the attempt's exam version. Save with an upsert so the student can change their answer. Return the saved question and selected option IDs. The client should save after every selection and may also batch pending writes when navigating, but local state alone is not a durable answer.

#### Submit an attempt

The student submits with an empty body, or optionally `{ "reason": "student" }`. The server determines whether the attempt is still in time. In a single transaction it should lock the attempt row, verify status, grade using the private answer key, set score and submitted time, and mark it `submitted` or `auto_submitted`. Repeated submissions must return the same final result instead of grading twice.

Example response:

```json
{
  "attemptId": "attempt-uuid",
  "status": "submitted",
  "submittedAt": "2026-11-20T08:24:35Z",
  "class": "Primary 5",
  "subject": "Mathematics",
  "answeredCount": 18,
  "questionCount": 20,
  "message": "Your exam has been submitted successfully."
}
```

Do not return the answer key on student submission unless the school explicitly wants immediate review and the exam policy permits it.

## 5. Timer and automatic submission

The browser countdown is a display aid only. A student can change JavaScript, change their device clock, or disconnect. The backend's `expires_at` is authoritative.

- At start, set `expires_at = server_now + exam.duration_seconds`.
- Return `serverTime` and `expiresAt`; compute the browser countdown from their difference. Do not trust the student's wall clock as the deadline.
- Reject answer writes after expiry.
- If a submit request arrives at or after expiry, finalize it as `auto_submitted` and grade saved answers.
- Finalize expired active attempts when the attempt is loaded or an answer/submit request arrives. A scheduled worker can also sweep expired attempts, but correctness must not depend on the worker running exactly on time.
- If the browser disconnects, keep previously saved answers and finalize at expiry. Decide whether reconnecting is allowed; if so, return the same attempt and remaining server time.
- Make submit idempotent to handle timer and manual-submit requests arriving together.

The current UI has a configurable `EXAM_DURATION_MINUTES` constant in `cbt/assets/js/exam.js`. The backend should own the production duration. The intended duration discussed for this feature is 30 minutes (`1800` seconds); confirm the frontend constant before launch, and do not let it override the duration stored on the exam.

## 6. Session, authorization, and transport security

The existing admin app uses same-origin requests, cookies, and a CSRF token pattern through `/api-proxy` in local development. The CBT API should follow the backend's established authentication conventions rather than inventing a separate token mechanism.

- Store admin sessions in secure, `HttpOnly`, `SameSite` cookies where possible; require CSRF protection on state-changing cookie-authenticated requests.
- For student attempts, issue a separate short-lived, scoped session bound to a student and attempt. An opaque server-side session cookie is preferable. If using bearer tokens, keep them short-lived and scoped; do not put them in localStorage.
- Use HTTPS in production. Restrict CORS to the actual frontend origin; do not combine wildcard origins with credentialed requests.
- Check ownership on every attempt read/write. Knowing an attempt UUID must not grant access to it.
- Enforce roles/permissions for create, edit, publish, close, result review, and export actions.
- Validate all request bodies and path IDs server-side; use parameterized database queries.
- Add rate limits to student access/ID lookup, attempt creation, answer writes, and admin login.
- Avoid logging student answers or access credentials in general request logs. Keep a purpose-limited audit record for exam lifecycle and submission events.

## 7. Error format and status codes

Use a consistent error response such as:

```json
{
  "error": {
    "code": "ATTEMPT_EXPIRED",
    "message": "This exam attempt has expired.",
    "requestId": "request-uuid"
  }
}
```

Suggested status codes:

- `400` malformed request or invalid question structure
- `401` missing/invalid admin or student session
- `403` authenticated user is not eligible for this class/exam/action
- `404` unknown exam/attempt (avoid student enumeration in access responses)
- `409` exam closed, duplicate attempt, already submitted, or incompatible edit/version state
- `422` valid JSON but invalid field values
- `429` rate limit
- `500` unexpected server error, with details only in server logs

The frontend should distinguish validation errors from expired attempts and network errors. It should keep the candidate informed if answer saving fails and retry safely; it must not show a successful final confirmation until the submission endpoint confirms completion.

## 8. Mapping the current frontend to the API

The current admin page reads/writes the `phronesis_cbt_question_sets_v1` browser key. Replace `readSets` and `writeSets` in `admin/assets/js/pages/cbt.js` with API calls:

- Initial page load: `GET /api/v1/admin/cbt/exams`
- Create: `POST /api/v1/admin/cbt/exams`
- Open edit modal: `GET /api/v1/admin/cbt/exams/:examId`
- Save edits: `PUT /api/v1/admin/cbt/exams/:examId`
- Delete button: archive/close endpoint instead of deleting submitted history

The current student page reads `phronesis_cbt_question_sets_v1`, stores active work under `phronesis_cbt_active_attempt_v1`, and writes local submissions to `phronesis_cbt_submissions_v1`. Replace those operations in `cbt/assets/js/exam.js`:

1. Access form calls `POST /api/v1/cbt/access` and displays only exams returned for that student.
2. Starting a selected exam calls `POST /api/v1/cbt/attempts`; use the response class, subject, question IDs, and server expiry.
3. Resume calls `GET /api/v1/cbt/attempts/:attemptId` using the scoped attempt session.
4. Selecting A–D calls `PUT /api/v1/cbt/attempts/:attemptId/answers/:questionId` with the selected option ID. Keep the local answer highlight responsive, but reconcile it with server success.
5. Manual and timer submit both call `POST /api/v1/cbt/attempts/:attemptId/submit`. Show the current success confirmation and its five-second return to `/cbt` only after the server confirms the attempt is finalized.

Keep shortcut behavior (N/P/A–D/S) in the browser. The keys trigger UI navigation/selection; they do not replace server-side authorization, persistence, or expiry enforcement.

## 9. Rollout plan

1. Confirm the backend framework, database, current student/class/subject tables, and session/CSRF conventions.
2. Add migrations for exams, immutable versions/questions/options, attempts, and answers; add foreign keys and uniqueness constraints.
3. Implement admin CRUD and publish validation; exercise it against the existing admin authentication.
4. Implement student access and eligibility checks; decide whether unique ID alone is acceptable or add a PIN/OTP.
5. Implement start/resume, answer saving, deadline enforcement, idempotent submission, and server-side grading.
6. Replace localStorage access in the admin and student JavaScript with API requests; keep the UI behavior and map API records into the existing view model.
7. Test concurrent requests, expired attempts, changed answers, duplicate submit, admin edits during attempts, network loss/reconnect, and students outside the assigned class.
8. Deploy migrations and API before enabling the student link. Use a test exam and test student IDs, verify results from the admin side, then open access to the target class.

## 10. Acceptance checklist

- [ ] Admins can create a draft with class, subject, duration, and objective questions.
- [ ] Every question is validated to contain options A–D and one correct answer.
- [ ] Only authorized admins can view correctness data or manage exam status.
- [ ] Students see only exams assigned to their class and currently available to them.
- [ ] A student cannot start a second attempt when policy prohibits retakes.
- [ ] The server starts the timer and returns an authoritative expiry time.
- [ ] Student exam responses never contain correct-answer metadata.
- [ ] Every answer is checked against the current student's active attempt and exam version.
- [ ] Answer changes are saved to the backend and survive browser refresh/reconnect.
- [ ] Late answers are rejected and expired attempts are automatically finalized.
- [ ] Manual submission confirms once in the UI; backend submission is idempotent.
- [ ] Score is calculated on the server from the private answer key.
- [ ] Admins can review submitted attempts/results without changing historical exam content.
- [ ] Class, subject, student identity, status, and timestamps are clear in admin results.
- [ ] Attempts, edits, publish/close actions, and final submissions have appropriate audit records.
