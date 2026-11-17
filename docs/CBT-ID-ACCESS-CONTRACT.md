# CBT Admission-Number Access Contract

Students access CBT without a school-portal login. They enter only their admission number. The backend verifies it, creates a temporary CBT candidate session cookie, and returns the exams assigned to that student's class.

## Access request

The frontend sends this JSON to the candidate-access route:

```json
{ "admissionNumber": "PSS-J/2026/083" }
```

The backend exposes `POST /cbt/access`, `POST /student/cbt/access`, and `POST /api-proxy/cbt/access` aliases. The local frontend requests `/api-proxy/cbt/access`; the development proxy forwards it to the backend `/api-proxy/cbt/access` alias.

On success, set a temporary `HttpOnly` candidate-session cookie and return the verified candidate if useful. The backend must check that the admission number matches exactly one active student. Do not ask the student for a class, subject, PIN, or portal password.

## Candidate exam flow

After access succeeds, the frontend calls `GET /cbt/exams`. The server uses the candidate session to identify the student's current class and only returns published exams assigned to that class. The exam records supply the class and subject details shown to the student.

Use the `/cbt` route aliases for the candidate flow. The backend also lists `/student/cbt` aliases, but those paths may overlap with the school's existing login-protected student API routes.

- `POST /cbt/exams/:examId/attempts`
- `GET /cbt/attempts/:attemptId`
- `PUT /cbt/attempts/:attemptId/answers/:questionId`
- `POST /cbt/attempts/:attemptId/submit`
- `POST /cbt/logout` to end the candidate session

All these routes use the temporary candidate cookie. The backend controls exam eligibility, attempt expiry, answer persistence, and grading. Student responses must omit correct-answer information. Apply the access rate limiter and CSRF protection to cookie-authenticated writes.

## Error behavior

Return a generic error for an unknown or inactive admission number, and do not reveal whether a given number belongs to a student. The frontend displays the backend message and does not continue to exam selection unless access succeeds.
