import { useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { useI18n } from "../hooks/useI18n";
export function TagInput({
  value,
  onChange,
  max,
  label,
  error,
  suggestions = [],
}: {
  value: string[];
  onChange: (v: string[]) => void;
  max: number;
  label: string;
  error?: string;
  suggestions?: string[];
}) {
  const [text, setText] = useState(""),
    { t } = useI18n(),
    id = useId();
  function add(raw: string) {
    const tags = raw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      next = [...value];
    for (const tag of tags) {
      if (
        tag.length <= 30 &&
        next.length < max &&
        !next.some((x) => x.toLowerCase() === tag.toLowerCase())
      )
        next.push(tag);
    }
    onChange(next);
    setText("");
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`tag-input ${error ? "invalid" : ""}`}>
        <div className="tags">
          {value.map((tag) => (
            <button
              type="button"
              key={tag}
              className="tag"
              aria-label={t("common.remove", { name: tag })}
              onClick={() => onChange(value.filter((v) => v !== tag))}
            >
              {tag}
              <X size={14} />
            </button>
          ))}
        </div>
        <div className="flex">
          <input
            id={id}
            value={text}
            maxLength={30}
            placeholder={t("field.tags.placeholder")}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-hint`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add(text);
              } else if (e.key === "Backspace" && !text)
                onChange(value.slice(0, -1));
            }}
          />
          <button
            type="button"
            disabled={!text.trim() || value.length >= max}
            onClick={() => add(text)}
            aria-label={t("common.add")}
            className="icon-button"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
      <p id={`${id}-hint`} className="hint">
        {t("field.tags.hint", { max })}
      </p>
      {error && <p className="error-text">{error}</p>}
      <div className="suggestions">
        {suggestions
          .filter(
            (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()),
          )
          .map((s) => (
            <button
              type="button"
              disabled={value.length >= max}
              key={s}
              onClick={() => add(s)}
            >
              + {s}
            </button>
          ))}
      </div>
    </div>
  );
}
