import { useEffect, useRef, useState } from 'preact/hooks';
import type { WidgetUser } from '../../shared/protocol';
import { isBasicEmail, type PreChatFieldKey } from '../lib/pre-chat';
import { STR } from '../lib/strings';

const FIELD_ATTRS: Record<
  PreChatFieldKey,
  { label: string; type: string; inputmode?: string; autocomplete: string }
> = {
  name: { label: STR.preChatName, type: 'text', autocomplete: 'name' },
  email: { label: STR.preChatEmail, type: 'email', inputmode: 'email', autocomplete: 'email' },
  phone: { label: STR.preChatPhone, type: 'tel', inputmode: 'tel', autocomplete: 'tel' },
  document: { label: STR.preChatDocument, type: 'text', autocomplete: 'off' },
};

export function PreChatForm(props: {
  fields: PreChatFieldKey[];
  onSubmit(values: WidgetUser): void;
}) {
  const [values, setValues] = useState<Partial<Record<PreChatFieldKey, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<PreChatFieldKey, string>>>({});
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      firstRef.current?.focus();
    }
  }, []);

  const submit = (event: Event) => {
    event.preventDefault();
    const nextErrors: Partial<Record<PreChatFieldKey, string>> = {};
    const user: WidgetUser = {};
    for (const field of props.fields) {
      const value = (values[field] ?? '').trim().slice(0, 255);
      if (!value) nextErrors[field] = STR.preChatRequired;
      else if (field === 'email' && !isBasicEmail(value)) nextErrors[field] = STR.preChatEmailInvalid;
      else user[field] = value;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) props.onSubmit(user);
  };

  return (
    <form class="prechat" novalidate onSubmit={submit}>
      <div class="prechat-head">
        <p class="prechat-title">{STR.preChatTitle}</p>
        <p class="prechat-intro">{STR.preChatIntro}</p>
      </div>

      {props.fields.map((field, index) => {
        const attrs = FIELD_ATTRS[field];
        const error = errors[field];
        return (
          <label class="prechat-field" key={field}>
            <span class="prechat-label">{attrs.label}</span>
            <input
              ref={index === 0 ? firstRef : undefined}
              class={'prechat-input' + (error ? ' prechat-input--invalid' : '')}
              type={attrs.type}
              inputmode={attrs.inputmode}
              autocomplete={attrs.autocomplete}
              maxlength={255}
              value={values[field] ?? ''}
              aria-invalid={error ? 'true' : undefined}
              onInput={(event) => {
                const value = event.currentTarget.value;
                setValues((current) => ({ ...current, [field]: value }));
              }}
            />
            {error && (
              <span class="prechat-error" role="alert">
                {error}
              </span>
            )}
          </label>
        );
      })}

      <button type="submit" class="conv-new prechat-submit">
        {STR.preChatSubmit}
      </button>
    </form>
  );
}
