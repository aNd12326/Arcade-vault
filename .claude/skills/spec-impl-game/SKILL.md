---
name: spec-impl-game
description: Implements an approved game spec (same flow as /spec-impl), then sequentially dispatches skin-designer and mobile-porter against the implemented game.
disable-model-invocation: true
argument-hint: <NN-slug-game>
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementer of approved game specs + post-game pipeline

Same lineamiento as `/spec-impl` (validate "Approved" → branch → step-by-step impl
with per-step diff pauses). After implementation completes, it runs the canonical
post-game pipeline: **`skin-designer` first, then `mobile-porter`**, one after the
other, **never in parallel**, both targeting the game just implemented.

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

---

## Instructions

Follow these five phases in strict order. **Do not advance to the next phase if the previous one did not complete correctly.**

---

### Phase 1 — Identify the spec (and derive the game id)

The received argument is: `$ARGUMENTS`

If `$ARGUMENTS` is empty:

- List the files available in `specs/` (you already have them above).
- Ask the user to specify the exact name of the spec.
- Stop and wait for an answer. Do not continue.

If `$ARGUMENTS` has a value:

- Look for the file in `specs/`. The user may have written the full name (`07-tetris-game`), only the number (`07`), or only the slug (`tetris-game` / `tetris`). Try to find the correct file in any of those cases.
- If you do not find the file, show the available specs and ask the user to correct the name.
- If you do find it, continue.

**This command is for game specs only.** Game specs are named `specs/NN-<slug>-game.md`.

- **Derive the game id** from the filename: strip the leading `NN-` and the trailing `-game` (e.g. `07-tetris-game.md` → `tetris`; `09-snake-game.md` → `snake`).
- If the located spec is **not** a game spec (no `-game` suffix, or no derivable id — e.g. `04-supabase-integration.md`), **stop** and tell the user:

  ```
  ❌ /spec-impl-game only implements game specs (specs/NN-<slug>-game.md).
  For non-game specs use /spec-impl instead.
  ```

- Otherwise, **remember the derived game id** — it is the target passed to both agents in Phase 5. Continue to Phase 2.

---

### Phase 2 — Validate the spec's state

Read the spec file you located in Phase 1 using the Read tool or `cat`.

In the file's contents, look for the line that contains the spec's state. The header label is typically `**Status:**` (English) or `**Estado:**` (Spanish), but it may use any language. Match by position (status line near the top of the spec) and by the surrounding state machine, not by the exact label.

**Absolute rule:** You can only continue if the state **means "Approved"** — regardless of the language used.

Treat any of the following (and their equivalents in other languages) as the **Approved** state and continue:

- English: `Approved`
- Spanish: `Aprobado`
- Portuguese: `Aprovado`
- French: `Approuvé`
- German: `Genehmigt`
- Italian: `Approvato`
- …or any other language's word that clearly means "approved"

Anything else (Draft / Borrador, In review / En revisión, Implemented / Implementado, Obsolete / Obsoleto, or any unrecognized value) means **stop** and show the error message below.

| State category                            | Examples (any language)                           | Action                                                                     |
| ----------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| Approved                                  | `Approved`, `Aprobado`, `Aprovado`, `Approuvé`, … | Continue to Phase 3.                                                       |
| Draft                                     | `Draft`, `Borrador`, …                            | Stop. Show the error message below.                                        |
| In review                                 | `In review`, `En revisión`, …                     | Stop. Show the error message below.                                        |
| Implemented                               | `Implemented`, `Implementado`, …                  | Stop. Show the error message below.                                        |
| Obsolete                                  | `Obsolete`, `Obsoleto`, …                         | Stop. Show the error message below.                                        |
| State line not found / unrecognized value | —                                                 | Stop. The file does not follow the expected format. Tell this to the user. |

If you are unsure whether a value means "approved", **do not assume**. Stop and ask the user to clarify or to update the spec to the canonical wording.

**Standard error message when the state does not mean Approved:**

```
❌ I cannot implement this spec.

Current state: [STATE FOUND]
I only work with specs whose state means "Approved" (e.g. `Approved`, `Aprobado`,
or the equivalent in another language).

To continue you have two options:
  1. If the spec is ready to be implemented, open it and change the state
     to "Approved" (or the equivalent term your team uses) manually.
     That change is made by the human, not the agent.
  2. If the spec still needs work, use /spec [name] to resume it.
```

Do not offer alternatives, do not suggest "I can still start if you want". The block is intentional.

---

### Phase 3 — Create the git branch and switch to it

Once you have confirmed the state means `Approved`:

1. Derive the branch name from the spec file's full name, without the extension. Format: `spec-NN-slug`. Examples:
   - `07-tetris-game.md` → branch `spec-07-tetris-game`
   - `09-snake-game.md` → branch `spec-09-snake-game`

2. Check whether the branch already exists:
   - If it **does not exist**: create it with `git checkout -b spec-NN-slug`.
   - If it **already exists**: inform the user that the branch already existed (it may mean previous work is being resumed).
   - In both cases: switch to the branch with `git checkout spec-NN-slug` and confirm the change was successful before continuing.

3. Visually confirm to the user that the branch was created and that you are on it:

   ```
   ✅ Ready to implement.

   Spec:    specs/NN-slug.md
   Branch:  spec-NN-slug  (active)
   Game id: <game-id>      (← derived in Phase 1; target for the post-game pipeline)
   State:   Approved       (← echo back the actual value found in the spec)
   ```

4. **Do not start implementing yet.** First show the spec summary to the user so they have it fresh. Extract and show:
   - The **objective** (the line after `**Objective:**` / `**Objetivo:**` / equivalent label).
   - The **scope** (the `## Scope` / `## Alcance` / equivalent section).
   - The **implementation plan** (the section with the numbered steps — `## Implementation plan` / `## Plan de implementación` / equivalent).
   - The **acceptance criteria** (the checklist — `## Acceptance criteria` / `## Criterios de aceptación` / equivalent).

Match section headings by meaning, not by exact wording — the spec may be authored in any language.

---

### Phase 4 — Implement step by step

After showing the spec summary, tell the user:

```
I am going to implement the spec following the implementation plan exactly.
I will pause after each step so you can review the diff.

Shall we start with Step 1?
```

Wait for explicit confirmation ("yes", "go ahead", "go", or equivalent). Do not start without it.

Once confirmed, follow these rules during the entire implementation:

**One rule above all:** implement what the spec says. If something in the spec looks suboptimal to you, mention it as an observation but implement what was agreed. Changes to the spec go into the spec, not into the code by surprise.

**Work rhythm:**

- Implement one step of the plan.
- Show a summary of which files you touched and what you did.
- Say: `Step N completed. Could you review the diff and let me know if I continue with Step N+1?`
- Wait for confirmation before continuing.

**If during the implementation you find an ambiguity** the spec does not resolve:

- Stop.
- Describe the ambiguity exactly.
- Present two or three concrete options.
- Wait for the user's decision.
- Do not improvise.

**If the user asks for something that is out of the spec's scope:**

- Remind them that it is out of this spec's scope.
- Suggest noting it down for the next spec.
- Do not implement it on this branch.

**When finishing the last step:**

```
✅ All steps of the plan are implemented.

Next step: verify the spec's acceptance criteria one by one.
If they all pass, update the spec's state to "Implemented" (or the equivalent
in your repo's language) and make the final commit before merging this branch.
```

Then continue to Phase 5.

---

### Phase 5 — Post-implementation agent pipeline

This is what makes `/spec-impl-game` different from `/spec-impl`. After the last
plan step, run the canonical post-game pipeline against the **game id derived in
Phase 1**.

1. **Single confirmation gate.** Print exactly one gate and wait for an explicit
   yes/no:

   ```
   Implementation done. Next I'll run the post-game pipeline on `<game-id>`:
     1. skin-designer  (3 canonical skins: clasico, retro, neon)
     2. mobile-porter  (touch controls, spec 10)
   They run one after the other, never in parallel. Proceed? (yes/no)
   ```

   - If the user **declines**, stop. Leave the implementation branch as-is and say
     they can run `@skin-designer` / `@mobile-porter` manually later.
   - If the user **confirms**, proceed. **No further confirmation** is asked between
     the two agents — they auto-chain.

2. **Dispatch `skin-designer` FIRST.** Use the Agent tool with
   `subagent_type: skin-designer` and a prompt naming the target game id, e.g.:

   > Aplica los 3 skins canónicos (`clasico`, `retro`, `neon`) al juego `<game-id>`.

   **Wait for skin-designer to fully return** before doing anything else. Relay a
   one-line summary of what it did.

3. **Only then dispatch `mobile-porter` SECOND.** Use the Agent tool with
   `subagent_type: mobile-porter` and a prompt naming the **same** game id, e.g.:

   > Porta el juego `<game-id>` a mobile (controles táctiles, spec 10).

   Wait for it to return and relay a one-line summary.

   **Sequencing is mandatory:** the two Agent calls MUST be made in **separate
   messages/turns** — never batched in one tool block — so they cannot run in
   parallel. skin-designer must completely finish before mobile-porter starts.

4. **Final summary** after mobile-porter returns:

   ```
   ✅ Game spec implemented + post-game pipeline done for `<game-id>`.
     • skin-designer → <one-line result>
     • mobile-porter → <one-line result>

   Next: verify the spec's acceptance criteria one by one, then update the spec's
   state to "Implemented" and make the final commit before merging this branch.
   ```

---

## Summary of expected behavior

```
/spec-impl-game 07-tetris-game

  Phase 1  →  Finds specs/07-tetris-game.md → game id = "tetris"
  Phase 2  →  Reads the state → "Approved" (or "Aprobado", etc.) → ✅ continues
  Phase 3  →  git checkout -b spec-07-tetris-game → git checkout spec-07-tetris-game
              Shows game id, objective, scope, plan and criteria
  Phase 4  →  Implements step by step with pauses
  Phase 5  →  One confirmation gate → skin-designer (waits) → mobile-porter
              Sequential, never parallel. Final summary + verify criteria reminder.

/spec-impl-game 04-supabase-integration  (not a game spec)

  Phase 1  →  Finds the file but no "-game" suffix → ❌ stops
              "only implements game specs" — no branch, no code, no agents

/spec-impl-game 08-arkanoid-game  (state: Draft / Borrador)

  Phase 1  →  Finds specs/08-arkanoid-game.md → game id = "arkanoid"
  Phase 2  →  Reads the state → "Draft" → ❌ stops
              Shows the standard error message
              Does not create branch, does not touch code, does not run agents
```
