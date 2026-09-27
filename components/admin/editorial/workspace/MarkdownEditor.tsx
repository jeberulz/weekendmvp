"use client";

import { useDeferredValue, useImperativeHandle, useMemo, useRef, type KeyboardEvent, type Ref } from "react";

import { EDITORIAL_LIMITS } from "@/lib/editorial/contracts/limits";
import { measureContent } from "@/lib/editorial/domain/counts";
import { adjacentHeadingOffset, lineAtOffset, offsetOfLine } from "@/lib/editorial/editor/outline";
import { formatCount } from "@/lib/editorial/presentation/format";
import { fieldClass } from "../common/primitives";

export type MarkdownEditorHandle = {
  /** Put the caret at the start of a 1-based line and scroll it into view. */
  jumpToLine(line: number): void;
};

const EDITOR_TEXT =
  "w-full rounded-md border border-(--ed-input) bg-(--ed-surface) px-4 py-3 font-mono text-[0.875rem] leading-[1.65] text-(--ed-text) whitespace-pre-wrap break-words";

/**
 * Plain Markdown editing: a textarea with keyboard section navigation.
 * Cmd/Ctrl-S is handled by the workspace so it works from any field.
 */
export function MarkdownEditor({
  ref,
  title,
  markdown,
  readOnly,
  onTitle,
  onMarkdown,
  onNavigate,
}: {
  ref?: Ref<MarkdownEditorHandle>;
  title: string;
  markdown: string;
  readOnly: boolean;
  onTitle(title: string): void;
  onMarkdown(markdown: string): void;
  /** Announce where keyboard navigation landed. */
  onNavigate(message: string): void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const moveCaret = (offset: number) => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(offset, offset);
    if (mirror) {
      // Measure the wrapped height of the text before the caret with an
      // identically styled hidden twin, then scroll that line near the top.
      mirror.textContent = textarea.value.slice(0, offset);
      const paddingBottom = Number.parseFloat(window.getComputedStyle(textarea).paddingBottom) || 0;
      textarea.scrollTop = Math.max(0, mirror.scrollHeight - paddingBottom - 32);
      mirror.textContent = "";
    }
  };

  useImperativeHandle(ref, () => ({
    jumpToLine(line: number) {
      const textarea = textareaRef.current;
      if (!textarea) return;
      moveCaret(offsetOfLine(textarea.value, line));
    },
  }));

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.ctrlKey && event.altKey) || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const target = adjacentHeadingOffset(textarea.value, textarea.selectionStart, direction);
    if (target === null) {
      onNavigate(direction === 1 ? "No later section." : "No earlier section.");
      return;
    }
    moveCaret(target);
    const line = textarea.value.slice(target).split("\n", 1)[0].replace(/^#+\s*/, "");
    onNavigate(`Moved to section ${line} (line ${lineAtOffset(textarea.value, target)}).`);
  };

  const deferred = useDeferredValue(markdown);
  const counts = useMemo(() => measureContent(deferred), [deferred]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="editor-title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="editor-title"
          className={`${fieldClass} text-base font-medium`}
          value={title}
          maxLength={EDITORIAL_LIMITS.titleChars}
          readOnly={readOnly}
          onChange={(event) => onTitle(event.target.value.replace(/[\r\n]+/g, " "))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="editor-body" className="text-sm font-medium">
          Article (Markdown)
        </label>
        <p id="editor-body-help" className="text-xs text-(--ed-text-2)">
          CommonMark and GitHub tables only; MDX, HTML and scripts are shown as text, never run.{" "}
          <kbd className="font-mono">⌘S</kbd>/<kbd className="font-mono">Ctrl+S</kbd> saves.{" "}
          <kbd className="font-mono">Ctrl+Alt+↓</kbd>/<kbd className="font-mono">↑</kbd> moves between sections.
        </p>
        <div className="relative">
          <textarea
            ref={textareaRef}
            id="editor-body"
            aria-describedby="editor-body-help editor-counts"
            className={`${EDITOR_TEXT} block h-[68vh] min-h-80 resize-y overflow-y-auto outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-(--ed-focus) read-only:bg-(--ed-sunk)`}
            value={markdown}
            readOnly={readOnly}
            spellCheck
            maxLength={EDITORIAL_LIMITS.markdownChars}
            onChange={(event) => onMarkdown(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <div
            ref={mirrorRef}
            aria-hidden="true"
            className={`${EDITOR_TEXT} pointer-events-none invisible absolute inset-x-0 top-0 overflow-y-scroll`}
          />
        </div>
      </div>
      <p id="editor-counts" className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-(--ed-text-2)">
        <span>Measured from the text above (not a quality score):</span>
        <span>
          <span className="font-mono tabular-nums text-(--ed-text)">{formatCount(counts.proseWords)}</span> prose words
        </span>
        <span>
          about <span className="font-mono tabular-nums text-(--ed-text)">{counts.readingMinutes}</span> min read
        </span>
        <span>
          <span className="font-mono tabular-nums text-(--ed-text)">
            {counts.sectionsPresent}/{counts.sectionsExpected}
          </span>{" "}
          sections
        </span>
        <span>
          <span className="font-mono tabular-nums text-(--ed-text)">{counts.prompts}</span> prompts
        </span>
        <span>
          <span className="font-mono tabular-nums text-(--ed-text)">{counts.codeBlocks}</span> code blocks
        </span>
      </p>
    </div>
  );
}
