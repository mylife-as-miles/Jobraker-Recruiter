export const skill = String.raw`
# App Navigation Skill

You have access to the **app-navigation** tool which lets you control the Jobraker Recruiter UI directly: opening notes, switching app sections, navigating recruiter workflows, filtering the knowledge base, and creating saved views.

## Actions

### open-note
Open a specific knowledge file in the editor pane.

**Parameters:**
- ` + "`path`" + `: Full workspace-relative path, for example ` + "`knowledge/People/John Smith.md`" + `.

Use ` + "`file-grep`" + ` first if you need the exact path.

### open-view
Switch the UI to a high-level app section.

**Views:**
- ` + "`graph`" + `: Knowledge graph.
- ` + "`bases`" + `: Knowledge base table view.
- ` + "`recruiter`" + `: Jobraker Recruiter product screens.
- ` + "`meetings`" + `: Meetings calendar/notes view.
- ` + "`email`" + `: Email inbox view.
- ` + "`live-notes`" + `: Live meeting notes.
- ` + "`bg-tasks`" + `: Background agent tasks.
- ` + "`home`" + `: Home dashboard.
- ` + "`chat-history`" + `: Chat history.
- ` + "`suggested-topics`" + `: Suggested knowledge topics.
- ` + "`chat`" + `: Full chat view. Optionally pass ` + "`runId`" + `.
- ` + "`workspace`" + `: Workspace browser. Optionally pass ` + "`folderPath`" + `.
- ` + "`knowledge-view`" + `: Knowledge folder browser. Optionally pass ` + "`folderPath`" + `.
- ` + "`task`" + `: A background task. Pass ` + "`taskName`" + ` or ` + "`name`" + `.

**Recruiter options:**
- ` + "`recruiterScreen`" + `: ` + "`roles`" + `, ` + "`candidates`" + `, ` + "`pipeline`" + `, ` + "`analytics`" + `, or ` + "`sourcing`" + `.
- ` + "`candidateId`" + `: Candidate to focus when opening candidate-oriented screens.
- ` + "`initialAction`" + `: ` + "`add-candidate`" + ` or ` + "`add-role`" + ` to open the matching modal.

Examples:
- Open the pipeline: ` + "`app-navigation({ action: \"open-view\", view: \"recruiter\", recruiterScreen: \"pipeline\" })`" + `
- Add a candidate: ` + "`app-navigation({ action: \"open-view\", view: \"recruiter\", recruiterScreen: \"candidates\", initialAction: \"add-candidate\" })`" + `
- Open meetings: ` + "`app-navigation({ action: \"open-view\", view: \"meetings\" })`" + `

## Recruiter CRUD Database

Recruiter data is mirrored to ` + "`config/recruiter-db.json`" + `. The frontend writes local edits to this file, and external edits to the file are reloaded into the UI.

Database shape:
` + "```json" + `
{
  "candidates": [],
  "roles": [],
  "pipelineBoard": {},
  "candidateStages": {},
  "candidateNotes": {},
  "roleFavorites": [],
  "homeMetricsSnapshots": []
}
` + "```" + `

Use file edits for durable CRUD:
- Add candidates by appending to ` + "`candidates`" + ` with a unique ` + "`id`" + ` and matching fields such as ` + "`name`" + `, ` + "`title`" + `, ` + "`location`" + `, ` + "`experienceYears`" + `, ` + "`matchScore`" + `, ` + "`stage`" + `, ` + "`source`" + `, ` + "`skills`" + `, ` + "`highlights`" + `, ` + "`aiInsight`" + `, and ` + "`note`" + `.
- Move candidates by updating the candidate's ` + "`stage`" + `, ` + "`candidateStages[candidateId]`" + `, and the relevant arrays inside ` + "`pipelineBoard`" + `.
- Edit notes by updating ` + "`candidateNotes[candidateId]`" + ` and the candidate's ` + "`note`" + `.
- Add or edit roles through ` + "`roles`" + `, then keep ` + "`roleFavorites`" + ` aligned for favorited roles.

When performing CRUD, first read the current JSON, preserve unrelated fields, write the smallest safe change, then navigate to the relevant recruiter screen to show the result.

## Recruiting Playbooks

Candidate evaluation:
- Read ` + "`config/recruiter-db.json`" + `.
- Rank candidates by role fit, match score, skills, location, stage, and evidence in notes/highlights.
- For sourcing tasks, build a top 50-100 shortlist when enough candidates exist, then recommend the strongest few with evidence.

Interview scheduling:
- Prefer navigating to recruiter candidates or pipeline first.
- Update candidate notes/stage in the JSON if the user asks you to record scheduling intent.
- Use calendar/email tools only when available and appropriate; otherwise ask the user for the missing scheduling detail.

Interactive browser login:
- For LinkedIn or other authenticated sourcing, use browser-control.
- If authentication fails, ask the user to log in directly in the browser pane. Never request or store raw passwords.

## Knowledge Base Views

### update-base-view
Change filters, columns, sort order, or search in the bases view.

Use ` + "`filters.set`" + ` for fresh filtering. Omit ` + "`columns`" + ` and ` + "`sort`" + ` unless the user explicitly asks to change them.

### get-base-state
Inspect available frontmatter categories, values, and note counts before filtering if you are unsure.

### create-base
Save the current base/table configuration as a named view.

## Important Notes
- ` + "`open-note`" + ` validates that the file exists before navigating.
- ` + "`update-base-view`" + ` automatically opens the bases view if needed.
- Prefer app-navigation for UI movement and ` + "`config/recruiter-db.json`" + ` edits for durable recruiter CRUD.
`;

export default skill;
