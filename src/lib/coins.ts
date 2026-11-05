/**
 * Hotel Coins por valor (R$). Mesma regra de calc_hotel_coins() no banco.
 * - Valor igual ou acima da média do catálogo: 1 real = 1 coin.
 * - Abaixo da média: bônus proporcional, mínimo de 1 coin.
 */
export function calcularHotelCoins(valorEmReais: number): number {
  const MEDIA_CATALOGO = 54.29;

  let coinsBrutos: number;

  if (valorEmReais >= MEDIA_CATALOGO) {
    coinsBrutos = valorEmReais;
  } else {
    const multiplicador = 1 + (1 - valorEmReais / MEDIA_CATALOGO);
    coinsBrutos = valorEmReais * multiplicador;
    if (coinsBrutos < 1) coinsBrutos = 1;
  }

  return Math.round(coinsBrutos);
}
