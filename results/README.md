# Class Teacher Result Portal

The `/results` portal uses the Results API and class-scoped HTTP-only session cookie. In local development, requests use the existing `/api-proxy` path, which forwards them to the backend. In production, requests go directly to the API host configured in `assets/js/api.js`.

## Connected routes

- `GET /results/classes` loads the login class list.
- `POST /results/auth/login` signs in with `{ "classId": 3, "password": "..." }`.
- `GET /results/auth/me` supplies the assigned class, teacher, active session, and term.
- `POST /results/auth/logout` ends the session.
- `GET /results/classes/:classId/students` loads the class roster.
- `GET /results/classes/:classId/subjects` loads the class subject list from the school subject records. It must include every subject teachers can grade, whether its exam was taken on paper or as a CBT; the Results portal does not use the CBT subject list.
- `GET /results/classes/:classId/students/:studentId/scores` loads saved scores for the active period.
- `PUT /results/classes/:classId/students/:studentId/scores` saves scores with `sessionId`, `termId`, and one score object per configured subject.
- `GET /results/classes/:classId/standings` loads class rankings.
- `GET /results/classes/:classId/students/:studentId/results` loads the result modal detail.

The API client sends requests with `credentials: 'include'`, handles JSON errors, and includes a CSRF token when the API provides one. The backend remains responsible for class authorization, mark validation, score calculations, grades, and competition ranking.

## Expected response fields

The portal accepts camelCase or snake_case names for the common IDs, names, and score fields. The login class list should include an ID and display name. `/auth/me` should include `classId`, `className`, `teacherName`, `sessionId`, `termId`, and optional session/term display names. Student and subject lists should include stable IDs. Saved and detailed results should identify each subject by `subjectId` and return the raw marks plus backend-calculated `totalCA`, `finalTotal`, `percentage`, and `grade` where applicable.

Score saves must include every subject returned by the class subject endpoint. This includes paper-based assessments whose marks are being entered into the portal. The frontend previews the agreed grade bands while editing; persisted calculations and rankings from the backend are authoritative.
