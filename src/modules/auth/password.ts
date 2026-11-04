import bcrypt from "bcryptjs";

const COST = 10;

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/** Regras de senha. Devolve a mensagem de erro, ou null se estiver boa. */
export function checkPasswordRules(password: string): string | null {
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use letras e números na senha.";
  if (/^(12345678|1234567890|password|senha123)$/i.test(password)) return "Essa senha é muito comum. Escolha outra.";
  return null;
}
