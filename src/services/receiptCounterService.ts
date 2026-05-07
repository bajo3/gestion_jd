const YEAR_KEY = "receipt-counter-year";
const COUNTER_KEY = "receipt-counter-value";

function syncYear() {
  const currentYear = new Date().getFullYear();
  const storedYear = Number(localStorage.getItem(YEAR_KEY) || "0");

  if (storedYear !== currentYear) {
    localStorage.setItem(YEAR_KEY, String(currentYear));
    localStorage.setItem(COUNTER_KEY, "0");
  }

  return currentYear;
}

export function getNextReceiptNumber() {
  const year = syncYear();
  const counter = Number(localStorage.getItem(COUNTER_KEY) || "0");
  return `REC-${year}-${String(counter + 1).padStart(4, "0")}`;
}

export function commitReceiptNumber() {
  syncYear();
  const counter = Number(localStorage.getItem(COUNTER_KEY) || "0") + 1;
  localStorage.setItem(COUNTER_KEY, String(counter));
  return getNextReceiptNumber();
}
