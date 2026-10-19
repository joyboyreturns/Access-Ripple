import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Icon from './Icons';

export interface SelectOption {
  value: string;
  label: string;
  /** Secondary text shown on the right of each option, such as the page it sits on. */
  context?: string;
}

interface Props {
  id: string;
  label: string;
  placeholder: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * A searchable single-select combobox: one compact field, a filterable list of options,
 * and full keyboard support (arrows, Home/End, Enter, Escape, typing to filter).
 * Choosing the selected option again is not needed; a clear button stops following.
 */
export default function SelectMenu({ id, label, placeholder, options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const current = options.find((option) => option.value === value) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter((option) => `${option.label} ${option.context ?? ''}`.toLowerCase().includes(needle)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelectorAll('[role="option"]')[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open, filtered]);

  function openMenu() {
    const index = current ? options.findIndex((option) => option.value === value) : 0;
    setQuery('');
    setActive(Math.max(0, index));
    setOpen(true);
    requestAnimationFrame(() => input.current?.focus());
  }
  function closeMenu(refocus = false) {
    setOpen(false);
    setQuery('');
    if (refocus) input.current?.focus();
  }
  function choose(option: SelectOption) {
    onChange(option.value);
    setOpen(false);
    setQuery('');
    input.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { openMenu(); return; }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => Math.min(filtered.length - 1, Math.max(0, index + step)));
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      setActive(Math.max(0, filtered.length - 1));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      const option = filtered[active];
      if (option) choose(option);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    } else if (event.key === 'Tab' && open) {
      closeMenu();
    }
  }

  return <div className="journey-picker" ref={root}>
    <label htmlFor={id}>{label}</label>
    <div className="picker-anchor">
    <div className={`picker-field ${open ? 'open' : ''} ${value ? 'armed' : ''}`} onMouseDown={(event) => { if (event.target !== input.current) { event.preventDefault(); input.current?.focus(); if (!open) openMenu(); } }}>
      <Icon name="target" size={17} />
      <input
        id={id}
        ref={input}
        className="picker-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && filtered[active] ? optionId(active) : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        placeholder={open && current ? current.label : placeholder}
        value={open ? query : current?.label ?? ''}
        onChange={(event) => { setQuery(event.target.value); setActive(0); if (!open) setOpen(true); }}
        onClick={() => { if (!open) openMenu(); }}
        onKeyDown={onKeyDown}
      />
      {value && !open
        ? <button type="button" className="picker-clear" aria-label="Stop following this action" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(''); input.current?.focus(); }}><Icon name="close" size={14} /></button>
        : <Icon className={`picker-chevron ${open ? 'flipped' : ''}`} name="chevron" size={16} />}
    </div>
    {open && (filtered.length
      ? <div className="picker-popup"><ul role="listbox" id={listId} aria-label="Buttons and links on this website" ref={list}>
        {filtered.map((option, index) => <li
          key={option.value}
          id={optionId(index)}
          role="option"
          aria-selected={option.value === value}
          className={`picker-option ${index === active ? 'active' : ''}`}
          onMouseEnter={() => setActive(index)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => choose(option)}
        >
          <span className="picker-option-label">{option.label}</span>
          {option.context && <span className="picker-option-context">{option.context}</span>}
          {option.value === value && <Icon name="check" size={15} />}
        </li>)}
      </ul></div>
      : <div className="picker-popup"><p className="picker-empty">No actions match “{query}”. Try another phrase.</p></div>)}
    </div>
  </div>;
}
