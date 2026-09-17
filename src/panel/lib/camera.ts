import { policyState, type PolicyState } from './policy';

let cameraWarned = false;

export function cameraSupported(): boolean {
  return window.isSecureContext === true && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

export function cameraPolicyState(): PolicyState {
  return policyState('camera');
}

export function cameraPolicyBlocked(): boolean {
  return cameraPolicyState() === 'blocked';
}

export function warnCamera(err: unknown): void {
  if (cameraWarned) return;
  cameraWarned = true;
  const fault =
    err instanceof DOMException ? `${err.name}: ${err.message}` : 'câmera não delegada ao iframe do chat';
  try {
    console.warn(
      `[Pipeelo] câmera indisponível — ${fault}\n` +
        `contexto seguro: ${window.isSecureContext} | dentro de iframe: ${window.parent !== window} | ` +
        `Permissions-Policy: ${cameraPolicyState()} | origem do painel: ${location.origin}\n` +
        'Se o site publica Permissions-Policy, ela precisa delegar a câmera para o painel: ' +
        `Permissions-Policy: camera=(self "${location.origin}")`
    );
  } catch {
  }
}

export function openCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
}

export function capturePhoto(video: HTMLVideoElement): Promise<File | null> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (!context || canvas.width === 0) return Promise.resolve(null);
  context.drawImage(video, 0, 0);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }) : null),
      'image/jpeg',
      0.92
    );
  });
}
