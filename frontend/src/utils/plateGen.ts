// Generic procedural license-plate generator (Mercosul-style ABC1D23).
// Used only to demonstrate LPR (License Plate Recognition) coverage in the simulator —
// no real plate imagery or third-party assets involved.
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';

const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

export function generatePlate(): string {
  const l = () => pick(LETTERS);
  const d = () => pick(DIGITS);
  return `${l()}${l()}${l()}${d()}${l()}${d()}${d()}`;
}
