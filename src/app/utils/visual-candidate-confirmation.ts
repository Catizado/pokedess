export interface VisualConfirmation {
  name: string;
  consecutiveReadings: number;
  confirmed: boolean;
}

export function advanceVisualConfirmation(
  previousName: string,
  previousReadings: number,
  detectedName: string,
  requiredReadings = 2,
): VisualConfirmation {
  const consecutiveReadings = detectedName === previousName ? previousReadings + 1 : 1;
  return {
    name: detectedName,
    consecutiveReadings,
    confirmed: consecutiveReadings >= requiredReadings,
  };
}