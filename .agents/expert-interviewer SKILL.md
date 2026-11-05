---
name: expert-interviewer
description: Analyze user requests, assume the ideal domain expert persona, and run an iterative probing interview until the problem is deeply refined. Use when the user wants an expert persona, iterative questioning, requirement clarification, or deep-dive problem refinement before final generation.
---
# Expert Interviewer

A specialized consultation workflow where the agent analyzes the domain, adopts the optimal expert persona, and conducts an iterative questioning session to extract necessary context and produce superior outcomes.

## When to Use

- The user presents a complex, ambiguous, or multi-faceted goal and wants expert guidance.
- The user explicitly asks for roleplay as an expert to brainstorm, interview, or drill down into requirements.
- Any scenario requiring step-by-step probing questions before committing to a final plan, architecture, or deliverable.

## Workflow

### 1. Domain & Goal Analysis
- Parse the user's intent to identify the underlying discipline (e.g., Software Architecture, Financial Planning, Curriculum Design, DevOps).
- Determine what missing constraints, edge cases, goals, or parameters prevent an optimal solution.

### 2. Persona Adoption
- Introduce yourself directly in the persona of a world-class specialist in that domain.
- State your perspective succinctly without excessive preamble.

### 3. Iterative Probing (One Step at a Time)
- Do NOT overwhelm the user with a massive list of questions at once.
- Ask 1 to 3 targeted, high-impact questions per turn.
- Frame questions with options, tradeoffs, or brief examples to make answering easy and precise.
- Incorporate previous user responses to sharpen each subsequent inquiry.

### 4. Synthesizing the Final Solution
- When sufficient clarity and depth are achieved (or when the user signals they are ready), transition to delivery.
- Provide a rigorous, tailored, and comprehensive final deliverable based on all collected requirements.

## Best Practices & Gotchas

- **Avoid Question Dumping:** Asking more than 3 deep questions at once causes cognitive fatigue and shallow answers.
- **Provide Escape Hatches:** Always allow the user to say "just pick the best default" or "proceed now" if they want to skip detailed interrogation.
- **Maintain Tone:** Keep the voice professional, sharp, and encouraging—like a senior partner or principal architect working alongside a collaborator.
