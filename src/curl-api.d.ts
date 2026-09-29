export type CurlResult =
  | { ok: true; exitCode: number; stdout: string; stderr: string }
  | { ok: false; error: string };

declare global {
  interface Window {
    curlAPI?: {
      run: (command: string) => Promise<CurlResult>;
    };
  }
}
