const AUTH_KEY = "auth";
const USER = "admin";
const PASS = "2025";

export function isAuthenticated() {
  return localStorage.getItem(AUTH_KEY) === "ok";
}

export function login(username: string, password: string) {
  const valid = username.trim() === USER && password.trim() === PASS;

  if (valid) {
    localStorage.setItem(AUTH_KEY, "ok");
  }

  return valid;
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}
