// Simulates network/inference latency so the mocked services feel real in the UI
// (spinners, disabled buttons, optimistic states all get exercised).
export function delay(ms = 600): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
