// utils.js - funciones compartidas para Gestión JD

// Obtener valor de un input por id (con trim)
function getValue(id) {
  return (document.getElementById(id)?.value || "").trim();
}

// Obtener valor "crudo" (sin trim)
function getValueRaw(id) {
  return document.getElementById(id)?.value || "";
}

// Poner en mayúsculas de forma segura
function upper(str) {
  return (str || "").toUpperCase();
}

// Verifica login simple basado en localStorage
function requireAuth() {
  if (localStorage.getItem("auth") !== "ok") {
    window.location.href = "login.html";
  }
}

// Cerrar sesión
function logout() {
  localStorage.removeItem("auth");
  window.location.href = "login.html";
}
