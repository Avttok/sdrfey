"use client";

import { useActionState } from "react";
import { changePasswordAction, type FormState } from "@/modules/auth/actions";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { inputCls, labelCls } from "./ui";

export function PasswordForm({ submitLabel = "Salvar nova senha" }: { submitLabel?: string }) {
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="current" className={labelCls}>
          Senha atual
        </label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className={inputCls} />
      </div>
      <div>
        <label htmlFor="next" className={labelCls}>
          Nova senha
        </label>
        <input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
        <p className="mt-1.5 text-sm text-muted">Pelo menos 8 caracteres, com letras e números.</p>
      </div>
      <div>
        <label htmlFor="confirm" className={labelCls}>
          Repita a nova senha
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={inputCls} />
      </div>
      <FormMessage state={state} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
