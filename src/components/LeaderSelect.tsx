import { useEffect, useMemo, useRef, useState } from "react";
import type { LeaderOption } from "../types/stats";
import { LeaderThumb, setCodeOf } from "./LeaderThumb";

interface Props {
  label: string;
  options: LeaderOption[];
  value: string | null; // selected leader id
  onChange: (id: string) => void;
  placeholder?: string;
}

export function LeaderSelect({ label, options, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) choose(opt.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="leader-select" ref={rootRef}>
      <label className="leader-select__label">{label}</label>
      <div
        className={
          "leader-select__control" + (selected && !open ? " has-thumb has-set" : "")
        }
        onKeyDown={onKeyDown}
      >
        {selected && !open && (
          <span className="leader-select__thumb">
            <LeaderThumb leaderKey={selected.id} name={selected.name} size={24} />
          </span>
        )}
        <input
          className="leader-select__input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${label}-listbox`}
          value={open ? query : selected?.name ?? ""}
          placeholder={selected ? selected.name : placeholder ?? "Search leader…"}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {selected && !open && (
          <span className="leader-select__set">{setCodeOf(selected.id)}</span>
        )}
        <span className="leader-select__chevron" aria-hidden>
          ▼
        </span>
      </div>
      {open && (
        <ul className="leader-select__list" id={`${label}-listbox`} role="listbox">
          {filtered.length === 0 && options.length === 0 && (
            <li className="leader-select__empty">{placeholder ?? "No leaders available."}</li>
          )}
          {filtered.length === 0 && options.length > 0 && (
            <li className="leader-select__empty">No leaders match “{query}”.</li>
          )}
          {filtered.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={o.id === value}
              className={
                "leader-select__option" +
                (i === activeIndex ? " is-active" : "") +
                (o.id === value ? " is-selected" : "")
              }
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o.id);
              }}
            >
              <LeaderThumb leaderKey={o.id} name={o.name} size={30} />
              <span className="leader-select__option-name">{o.name}</span>
              <span className="leader-select__option-id">{setCodeOf(o.id)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
