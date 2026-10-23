/** The first characters of a device id, enough to tell devices apart. */
export function shortDeviceId(deviceId: string): string {
  return deviceId.slice(0, 8)
}
