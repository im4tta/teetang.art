export function formatCoordinates(lat: number, lon: number): string {
  const northSouth = lat >= 0 ? "N" : "S";
  const eastWest = lon >= 0 ? "E" : "W";

  return `${Math.abs(lat).toFixed(4)}° ${northSouth} / ${Math.abs(lon).toFixed(4)}° ${eastWest}`;
}

export function formatCoordinatesDMS(lat: number, lon: number): string {
  const toDMS = (val: number, isLat: boolean) => {
    const direction = isLat ? (val >= 0 ? "N" : "S") : val >= 0 ? "E" : "W";
    const absVal = Math.abs(val);
    const degrees = Math.floor(absVal);
    const minutesDecimal = (absVal - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = Math.round((minutesDecimal - minutes) * 60);
    return `${degrees}°${minutes}'${seconds}"${direction}`;
  };
  return `${toDMS(lat, true)} / ${toDMS(lon, false)}`;
}
