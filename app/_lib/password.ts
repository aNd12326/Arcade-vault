// Política de contraseñas (solo registro — ver SPEC 14).
// Requisitos: mínimo 8 caracteres, con minúscula, mayúscula, dígito y símbolo.
export const STRONG_PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function isStrongPassword(pw: string): boolean {
  return STRONG_PASSWORD_RE.test(pw);
}

export const PASSWORD_HINT =
  "La contraseña debe tener mínimo 8 caracteres e incluir minúscula, mayúscula, dígito y símbolo.";
