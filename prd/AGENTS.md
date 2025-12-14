# AGENTS.md – Entry

You are a coding agent working in this repo.

By default, you **read** `product_brief.md` and use it as background.
You only **collaborate on editing** `product_brief.md` when that makes sense.

You are currently in the **LIGHTWEIGHT PRODUCT LAYER**:
focus on product shape (OneSentenceGoal, TargetUser, Scenarios, Scope, Constraints, SuccessCriteria),
and avoid deep framework/infra discussion unless the user explicitly asks.

## A. If `product_brief.md` exists

- Read `product_brief.md` once and use:
  - Name, OneSentenceGoal, TargetUser, Scenarios, Scope, Constraints, SuccessCriteria
  as background and constraints for all your answers, designs, and code.
- Treat `product_brief.md` as **read-only by default**.
- Only when the user clearly wants to revise or maintain `product_brief.md`
  (e.g. asks you to review/rewrite/fix/tighten it or some part of it), you:

  1. Read `COLLAB_GUIDE.md` (if present).
  2. Follow `COLLAB_GUIDE.md` to collaborate on editing the brief.
  3. Treat all edits as suggestions until the user confirms they adopt them.

Otherwise, stay in this read-only mode and do not try to maintain the brief.

## B. If `product_brief.md` does NOT exist

When you do not see `product_brief.md`, do **not** treat free-form chat
as a replacement brief and start designing systems on top of it.

Instead, assume the first useful step is to create a minimal product brief:

1. Ask the user a short question like:

   > “我这边没看到 `product_brief.md`。
   >  要不要先一起用一个简单模板写一份 product brief，
   >  再在这个基础上讨论产品和实现？”

2. If the user agrees or does not object:
   - Treat this as entering **collaboration on the brief**.
   - Read `COLLAB_GUIDE.md` (if present).
   - Use the following template as the shape of `product_brief`:

     ```text
     Name:
     OneSentenceGoal:
     TargetUser:
     Scenarios:
       - [S1] ...
       - [S2] ...
     Scope:
       WillDo:
         - ...
       WillNotDo:
         - ...
     Constraints:
       - Users: ...
       - QPS: ...
       - (Infra / Simplify if needed)
     SuccessCriteria:
       - ...
     ```

   - Based on what the user has already described, propose a **first draft**
     filling this template, and iterate with the user until it roughly fits.

3. If the user explicitly says they **do not** want a brief for now
   (e.g. “先别写 brief，我们就先聊聊/写点代码”):
   - Do **not** create or maintain `product_brief.md`.
   - Do **not** read or rely on `COLLAB_GUIDE.md`.
   - Use the user’s description as background and answer their questions,
     but avoid inventing a hidden product brief.

## C. Shared rule

In all cases:

- All changes you propose to `product_brief.md` are **suggestions only**,
  until the user clearly confirms they adopt them.
- Never treat your own suggestion as already applied to `product_brief.md`
  without explicit user confirmation.

