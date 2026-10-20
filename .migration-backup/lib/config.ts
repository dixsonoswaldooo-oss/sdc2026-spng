// Kunci AI dibaca dari Secrets (environment). Jangan pernah ditulis di kode.
// Hanya boleh dipakai di sisi server (route handler / server action).
export function getRunpodConfig() {
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  if (!apiKey || !endpointId) {
    throw new Error("RUNPOD_API_KEY dan RUNPOD_ENDPOINT_ID belum diisi di Secrets.");
  }
  return { apiKey, endpointId };
}
