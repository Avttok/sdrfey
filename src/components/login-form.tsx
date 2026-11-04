"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";
import { loginAction, type FormState } from "@/modules/auth/actions";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { inputCls, labelCls } from "./ui";

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="username" className={labelCls}>
          Usuário
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          defaultValue={state.fields?.username}
          placeholder="nome.sobrenome"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="password" className={labelCls}>
          Senha
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${inputCls} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" name="remember" className="size-4 accent-[var(--accent)]" />
        Permanecer conectado por 30 dias
      </label>

      <FormMessage state={state} />
      <SubmitButton className="w-full">Entrar</SubmitButton>
    </form>
  );
}
