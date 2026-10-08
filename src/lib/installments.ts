export type Installment = {
  number: number;
  capital: number;
  interest: number;
  total: number;
  /** Capital que queda por pagar despues de esta cuota. */
  balance: number;
};

const MAX_INSTALLMENTS = 120;

/**
 * Plan de cuotas con el mismo calculo de la calculadora: capital en partes iguales mas
 * el interes (monto x TNA) repartido entre las cuotas. La diferencia por redondeo se
 * ajusta en la ultima para que el capital cierre exacto.
 */
export function buildInstallments(montoFinanciado: number, plazo: number, tna: number): Installment[] {
  const count = Math.min(Math.round(plazo), MAX_INSTALLMENTS);
  if (!(montoFinanciado > 0) || !(count > 0)) return [];

  const capitalEach = Math.round(montoFinanciado / count);
  const interestEach = Math.round((montoFinanciado * (tna / 100)) / count);
  let balance = montoFinanciado;

  return Array.from({ length: count }, (_, index) => {
    const last = index === count - 1;
    const capital = last ? balance : capitalEach;
    balance -= capital;
    return { number: index + 1, capital, interest: interestEach, total: capital + interestEach, balance: Math.max(balance, 0) };
  });
}
