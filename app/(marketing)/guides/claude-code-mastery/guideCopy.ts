// Copy deck for the Claude Code guide (WP103 pilot, placeholder run).
// Every tool fact below is a claim in guides/records/claude-code-mastery.json, word for word.
// Anything about John's own build is a PLACEHOLDER until he supplies the evidence, and the audit fails on it.

export const guideCopy = {
  "The Shift · Lede": "Claude Code does the typing. You still decide what to build, and you still decide whether the result is right.",
  "The Shift · What it is": "Claude Code is an agentic coding tool that reads your codebase, edits files, runs commands, and integrates with your development tools. That is a long list of things it can do for you. It is also a long list of things it can get wrong without telling you.",
  "The Shift · The new bottleneck": "The bottleneck moved. It used to be typing the code. Now it is saying clearly what you want and checking what comes back. This guide is a routine for both. It has five rungs and six skills, and each skill ends with a test you can run.",
  "The Shift · Honest catch": "A routine is not a result. Claude Code can build the wrong thing quickly, so the checks in this guide matter more than the speed.",

  "The Ladder · Lede": "Five rungs. Climb them in order. Each rung adds one habit, and each habit is small enough to start today.\n\nPLACEHOLDER: one real example per rung from John's own build.",

  "Set the rules · Reasoning": "A CLAUDE.md file gives Claude persistent instructions for a project, and Claude reads it at the start of every session. So write your rules down once, in a file, instead of repeating them in every chat.\n\nPut in what the project is, the commands that run it, and the rules you never want broken.",
  "Set the rules · Common mistakes": "- Writing a long essay. Keep each rule short and checkable.\n- Writing rules you have never tested.\n- Never updating the file after Claude gets something wrong.",
  "Set the rules · Worked example": "PLACEHOLDER: John shows the first rules file he wrote for weekendmvp.app and what it changed.",

  "Plan before you build · Reasoning": "In plan mode, Claude reads files and proposes a plan, and it makes no edits until you approve. Use it when the change is big enough that you would want to see the plan first.\n\nRead the plan. Change it. Approve it only when you could explain it to someone else.",
  "Plan before you build · Common mistakes": "- Approving a plan you did not read.\n- Asking for a whole app in one go.\n- Skipping the plan for work that touches many files.",
  "Plan before you build · Worked example": "PLACEHOLDER: John shows one plan he approved for weekendmvp.app and how it turned out.",

  "Build in small checked steps · Reasoning": "Anthropic's best practices page says that when Claude reports it is done and it isn't quite, the usual cause is that it had no way to check its own work. So give it a check to run, and run it yourself.\n\nA check can be a test, a typecheck, or just opening the page. One small step, one check, then the next step.",
  "Build in small checked steps · Common mistakes": "- Asking for five changes at once, so you cannot tell which one broke it.\n- Trusting the word done without a check.\n- Not reading the change before you keep it.",
  "Build in small checked steps · Worked example": "PLACEHOLDER: John shows one small step on weekendmvp.app, the check he ran, and what the check caught.",

  "Give it tools and skills · Reasoning": "Once a habit works, make it reusable. Pick one of these. Do not add all three in the same week.\n\n- To make a skill, create a SKILL.md file with instructions, and Claude adds it to its toolkit.\n- Hooks are user-defined shell commands that Claude Code runs at set points in its lifecycle, so certain actions always happen.\n- Subagents are specialized AI assistants that handle specific types of tasks, and they help when a side task would flood your main conversation with search results, logs, or file contents.",
  "Give it tools and skills · Common mistakes": "- Building a skill for something you have done once.\n- Adding a hook before you know the rule it should enforce.\n- Handing a subagent a task you have not described clearly.",
  "Give it tools and skills · Worked example": "PLACEHOLDER: John shows one skill or hook he built for weekendmvp.app and how often he uses it.",

  "Ship and review · Reasoning": "Claude Code supports fine-grained permissions, so you can set what the agent may do and what it may not. Set those limits before you let it run on its own.\n\nThen read the full change before it goes live, the same way you would read work from a new hire.",
  "Ship and review · Common mistakes": "- Shipping on the first green check without reading the change.\n- Giving it wider permissions than the task needs.\n- Not writing down what went wrong.",
  "Ship and review · Worked example": "PLACEHOLDER: John shows one release of weekendmvp.app, what he reviewed before it went live, and what he would change.",

  "The 6 Skills · Lede": "Each skill ends with a test you can run. If you cannot pass the test, repeat the skill. Do not move on.",

  "Write a rules file that sticks · Explanation": "A rules file only helps if you can tell whether a rule was followed. Write each rule so that one result shows it. Keep functions small is hard to check. Run the typecheck before you finish is easy to check.",
  "Write a rules file that sticks · Readiness test": "You're ready when your rules file is in your project, every rule can be checked in one look, and you have removed any rule you could not check.",

  "Turn a goal into a written plan · Explanation": "A plan is a short list of steps with a check at the end of each. Start with the goal in one sentence. Then ask for the steps. Edit the list until each step is small.",
  "Turn a goal into a written plan · Readiness test": "You're ready when you have a goal in one sentence and a plan where every step has a check you can run.",

  "Slice work into reviewable steps · Explanation": "A step is reviewable when you can read its whole change in a few minutes. If you cannot, the step is too big. Split it.",
  "Slice work into reviewable steps · Readiness test": "You're ready when you can name the next step, say which check will pass if it worked, and the change is small enough to read in one sitting.",

  "Verify, don't trust · Explanation": "Done is a claim. The check is the proof. Run the test, load the page, read the change. If there is no check, make one before you ask for the work.",
  "Verify, don't trust · Readiness test": "You're ready when you have caught one wrong result with a check you ran yourself, and you wrote down what the check was.",

  "Build one reusable skill · Explanation": "When you paste the same instructions more than twice, turn them into a skill. Start with something small that you do every week.",
  "Build one reusable skill · Readiness test": "You're ready when one skill exists in your project, you have run it twice, and the second run needed no extra explaining.",

  "Keep each session focused · Explanation": "Anthropic's best practices page says running /clear between tasks is still worth doing, because a focused context gets better answers and costs less. Finish one task, then start clean for the next. Carry over only what matters, and put that in your rules file.",
  "Keep each session focused · Readiness test": "You're ready when each task starts in a clean session, and what you want to keep is written in your rules file, not left in the chat.",

  "The Catch · Lede": "Most of what goes wrong comes from the same few places. Know them before you start.",
  "It can say it is done when it is not": "Claude can report it is done and be wrong. The fix is not to trust it less. The fix is to give it a check to run and to run it yourself.",
  "You still review everything": "Claude Code edits files and runs commands, so you are accountable for what it did. Read the change. Read the commands. If you cannot read it yet, take a smaller step.",
  "Fast is not the same as right": "A fast wrong answer costs more than a slow right one, because you build on top of it. This routine is slower at the start on purpose and faster after.",

  "Where You're Starting From · Lede": "Your starting point decides which rung is hardest. Find yourself below.",
  "Non-technical founder · Head start": "You know the problem and the customer. That is the part Claude Code cannot do for you.",
  "Non-technical founder · Gap": "You cannot yet read what it changes. Start with small steps and ask Claude to explain each change in plain words.",
  "Non-technical founder · Lean on": "The checks. Tests and the running page tell you what your eyes cannot yet.",
  "Designer · Head start": "You can see when something looks wrong, and you can describe what you want precisely.",
  "Designer · Gap": "You may not read the logic behind a change. Ask for the plan first and ask what each step could break.",
  "Designer · Lean on": "Screenshots and the running page. Check every result against your design.",
  "Developer · Head start": "You can read every change and judge it fast.",
  "Developer · Gap": "You may skip the plan and the rules file because you could just write the code yourself. The routine only pays off if you use it.",
  "Developer · Lean on": "Your own review habits. Treat Claude's output like a pull request from a new hire.",
  "Ops & marketing · Head start": "You know the process the product serves and how people use it.",
  "Ops & marketing · Gap": "You may not know what a safe change looks like. Keep permissions tight and steps small.",
  "Ops & marketing · Lean on": "Clear written steps. Writing down a process is the same skill as writing a good plan.",

  "The 30-Day Plan · Lede": "Four weeks. Each week ends with something you can show.\n\nPLACEHOLDER: the proof a reader ships each week.",
  "The 30-Day Plan · Honest catch": "Thirty days is a plan, not a promise. If a week slips, repeat it. Do not skip the check.",
  "Week 1 · Shipped proof": "PLACEHOLDER: John confirms this proof. Proposed: a rules file in your project and one small fix that you reviewed line by line.",
  "Week 2 · Shipped proof": "PLACEHOLDER: John confirms this proof. Proposed: one feature, planned in writing, built in small steps, each with a check.",
  "Week 3 · Shipped proof": "PLACEHOLDER: John confirms this proof. Proposed: one skill you reuse, and one check you run on every change.",
  "Week 4 · Shipped proof": "PLACEHOLDER: John confirms this proof. Proposed: a release you reviewed in full, with a short note on what went wrong and the rule you added.",

  "What I Built · Lede": "Rules and checks are easy to describe. This section shows the product they were run on. These are the facts the rest of the guide leans on.",
  "What I Built · The record": "- John built weekendmvp.app on his own with Claude Code.\n- More than 200 startup idea pages live in the weekendmvp.app repository.",
  "What I Built · The build story": "PLACEHOLDER: the story of what John built with Claude Code, with the real numbers.",
  "What I Built · What this does not prove": "A count of pages shows scale, not quality. The proof that matters is what you ship and check on your own project.",

  "Self-Check · Lede": "Check yourself against the routine. Your answers save on this device.",
  "Self-Check · Item 1": "My project has a rules file, and I wrote every rule so that I can check it.",
  "Self-Check · Item 2": "My rules file says what the project is and how to run it.",
  "Self-Check · Item 3": "I write a plan before any change that touches more than one file.",
  "Self-Check · Item 4": "I read the plan before I approve it.",
  "Self-Check · Item 5": "I ask for one small step at a time.",
  "Self-Check · Item 6": "Every step has a check I can run.",
  "Self-Check · Item 7": "I run the check myself, and I do not rely on the word done.",
  "Self-Check · Item 8": "I read the change before I keep it.",
  "Self-Check · Item 9": "I have made one reusable skill.",
  "Self-Check · Item 10": "I start each new task in a clean session.",
  "Self-Check · Item 11": "I set limits on what Claude Code may do before I let it run.",
  "Self-Check · Item 12": "I write down what went wrong and add a rule so it does not repeat.",

  "The Starter Rules File · Lede": "Copy this into a file named CLAUDE.md at the root of your project. Fill in the brackets. Delete any rule you cannot check.",
  "The Starter Rules File · Prompt text": "# Project\n[One sentence: what this project is and who it is for.]\n\n## Commands\n- Run the app: [command]\n- Run the tests: [command]\n- Check types or lint: [command]\n\n## Rules\n- Make one small change at a time. Show me the plan first for anything that touches more than one file.\n- Run the checks before you say a task is done, and show me the result.\n- Tell me what you could not check.\n- Do not delete files or change settings without asking.\n- [Add one rule each time something goes wrong.]\n\n## When you finish\n- Summarise what changed in plain words.\n- List anything I should check myself.",

  "FAQ · Do I need to code?": "Not to begin. You do need to read what changes, run the checks and say no to a result. If you cannot read it yet, take smaller steps and ask Claude to explain each change in plain words.",
  "FAQ · How is it different from Claude Projects?": "We wrote a separate comparison: [Claude Projects vs Claude Code](/articles/claude-projects-vs-claude-code).",
  "FAQ · Claude Code, Cursor or Lovable?": "We compare them in [Cursor vs Claude Code vs Lovable](/articles/cursor-vs-claude-code-vs-lovable-2026). This guide covers only the Claude Code routine.",
  "FAQ · Is it safe to point it at my repo?": "Claude Code supports fine-grained permissions, so you can set what the agent may do and what it may not. Start with tight limits and a copy of your project. Keep your work in version control so you can undo a change.",
  "FAQ · What if it gets stuck?": "Stop and look at the last check. Go back one small step and try again with a clearer instruction. If the session has wandered, start a clean one for the task and bring only what matters.",

  "Founder note · Body": "I run WeekendMVP. I wrote this guide for people who want to build with Claude Code without becoming a full-time developer.\n\nRun the routine on one small project first. I'd like to hear what you build.",
  "Gate · Fine print": "Free. Unsubscribe anytime.",
} as const;

export type GuideCopySlot = keyof typeof guideCopy;

export const selfCheckItems = Object.entries(guideCopy)
  .filter(([slot]) => slot.startsWith("Self-Check · Item "))
  .map(([, text]) => text);
