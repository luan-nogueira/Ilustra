export const DORI_PPM = {
  identify: 250,
  recognize: 125,
  observe: 62,
  detect: 25,
  monitor: 12
};

export const DORI_COLORS = {
  identify: '#ef4444', // Red
  recognize: '#facc15', // Yellow
  observe: '#22c55e', // Green
  detect: '#06b6d4', // Cyan
  monitor: '#3b82f6' // Blue
};

/**
 * Calcula o Field of View (Horizontal) em graus.
 * @param focalLength mm
 * @param sensorWidth mm
 */
export function calculateFOV(focalLength: number, sensorWidth: number): number {
  return 2 * Math.atan(sensorWidth / (2 * focalLength)) * (180 / Math.PI);
}

/**
 * Calcula a distância em metros em que um alvo será visto com a densidade de pixels (PPM) informada.
 * Padrão IEC/EN 62676-4.
 * 
 * @param resolutionWidth Pixels (ex: 1920)
 * @param focalLength mm
 * @param sensorWidth mm
 * @param targetPPM Pixels per meter (ex: 250 para Identificação)
 * @returns Distância em metros
 */
export function calculateDistanceForPPM(resolutionWidth: number, focalLength: number, sensorWidth: number, targetPPM: number): number {
  if (targetPPM <= 0) return 0;
  return (resolutionWidth * focalLength) / (targetPPM * sensorWidth);
}

/**
 * Retorna as distâncias (em metros) de cada zona DORI para a configuração da câmera.
 */
export function calculateDORIZones(resolutionWidth: number, focalLength: number, sensorWidth: number) {
  return {
    identify: calculateDistanceForPPM(resolutionWidth, focalLength, sensorWidth, DORI_PPM.identify),
    recognize: calculateDistanceForPPM(resolutionWidth, focalLength, sensorWidth, DORI_PPM.recognize),
    observe: calculateDistanceForPPM(resolutionWidth, focalLength, sensorWidth, DORI_PPM.observe),
    detect: calculateDistanceForPPM(resolutionWidth, focalLength, sensorWidth, DORI_PPM.detect),
    monitor: calculateDistanceForPPM(resolutionWidth, focalLength, sensorWidth, DORI_PPM.monitor),
  };
}
