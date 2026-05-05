"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Pack } from "@/lib/packs";

type Props = {
  value: string;
  onChange: (next: string) => void;
  onFocus?: () => void;
  suggestions: string[];
  placeholder?: string;
  pack: Pack;
};

type PopoverPosition = {
  top: number;
  left: number;
  width: number;
};

export function IngredientCombobox({
  value,
  onChange,
  onFocus,
  suggestions,
  placeholder = "Zutat — z. B. Magerquark",
  pack,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const filtered = useMemo(() => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.length < 1) return [];
    const startsWith: string[] = [];
    const includes: string[] = [];
    for (const s of suggestions) {
      const lower = s.toLowerCase();
      if (lower === trimmed) continue;
      if (lower.startsWith(trimmed)) startsWith.push(s);
      else if (lower.includes(trimmed)) includes.push(s);
    }
    return [...startsWith, ...includes].slice(0, 8);
  }, [value, suggestions]);

  const showDropdown = open && filtered.length > 0;

  // Track input position for the portal
  const updatePosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!showDropdown) return;
    updatePosition();
  }, [showDropdown, value]);

  useEffect(() => {
    if (!showDropdown) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [showDropdown]);

  // Close on outside click (check both input and popover)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideContainer = containerRef.current?.contains(target);
      const popoverEl = document.getElementById("combobox-popover-active");
      const insidePopover = popoverEl?.contains(target);
      if (!insideContainer && !insidePopover) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setHighlightedIdx(0);
  }, [filtered.length]);

  const select = (s: string) => {
    onChange(s);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          onFocus?.();
        }}
        onKeyDown={(e) => {
          if (!showDropdown) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIdx((i) => Math.min(filtered.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIdx((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            select(filtered[highlightedIdx]);
          } else if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Tab") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="editor-input"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
      />

      {mounted && showDropdown && position
        ? createPortal(
            <div
              id="combobox-popover-active"
              role="listbox"
              className="combobox-popover-portal"
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                width: position.width,
                background: "white",
                borderColor: pack.mood.ink + "20",
              }}
            >
              {filtered.map((s, idx) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(s);
                  }}
                  onMouseEnter={() => setHighlightedIdx(idx)}
                  role="option"
                  aria-selected={idx === highlightedIdx}
                  className="combobox-option"
                  style={{
                    background:
                      idx === highlightedIdx
                        ? pack.mood.background + "70"
                        : "transparent",
                    color: pack.mood.ink,
                  }}
                >
                  <span className="flex-1 truncate">
                    {highlightMatch(s, value)}
                  </span>
                  {idx === highlightedIdx ? (
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.14em]"
                      style={{ color: pack.mood.inkSoft }}
                    >
                      ↵
                    </span>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function highlightMatch(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const lower = text.toLowerCase();
  const q = trimmed.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          background: "transparent",
          color: "inherit",
          fontWeight: 700,
          textDecoration: "underline",
          textUnderlineOffset: "3px",
        }}
      >
        {text.slice(idx, idx + trimmed.length)}
      </mark>
      {text.slice(idx + trimmed.length)}
    </>
  );
}
