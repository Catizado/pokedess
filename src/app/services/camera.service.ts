import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CameraService {
  private activeStream: MediaStream | null = null;

  async listCameras(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      throw new Error('Este navegador no permite acceder a cámaras.');
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput');
  }

  async openCamera(deviceId?: string): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Este navegador no permite acceder a cámaras.');
    }
    this.stopCamera();
    const video = deviceId ? { deviceId: { exact: deviceId } } : true;
    const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    this.activeStream = stream;
    return stream;
  }

  stopCamera(): void {
    this.activeStream?.getTracks().forEach((track) => track.stop());
    this.activeStream = null;
  }

  captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      return false;
    }
    const context = canvas.getContext('2d', { willReadFrequently: false });
    if (!context) return false;
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return true;
  }

  captureTitleRegion(
    video: HTMLVideoElement,
    guide: HTMLElement,
    canvas: HTMLCanvasElement,
  ): boolean {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      return false;
    }
    const videoRect = video.getBoundingClientRect();
    const guideRect = guide.getBoundingClientRect();
    const scale = Math.min(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight);
    if (!scale) return false;

    const imageLeft = videoRect.left + (videoRect.width - video.videoWidth * scale) / 2;
    const imageTop = videoRect.top + (videoRect.height - video.videoHeight * scale) / 2;
    const cropLeft = guideRect.left + guideRect.width * 0.06;
    const cropTop = guideRect.top + guideRect.height * 0.045;
    const cropWidth = guideRect.width * 0.88;
    const cropHeight = guideRect.height * 0.22;
    const sourceLeft = Math.max(0, Math.round((cropLeft - imageLeft) / scale));
    const sourceTop = Math.max(0, Math.round((cropTop - imageTop) / scale));
    const sourceWidth = Math.min(video.videoWidth - sourceLeft, Math.round(cropWidth / scale));
    const sourceHeight = Math.min(video.videoHeight - sourceTop, Math.round(cropHeight / scale));
    if (sourceWidth <= 0 || sourceHeight <= 0) return false;

    if (canvas.width !== sourceWidth || canvas.height !== sourceHeight) {
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
    }
    const context = canvas.getContext('2d', { willReadFrequently: false });
    if (!context) return false;
    context.drawImage(video, sourceLeft, sourceTop, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    return true;
  }

  captureArtworkRegion(
    video: HTMLVideoElement,
    guide: HTMLElement,
    canvas: HTMLCanvasElement,
  ): boolean {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      return false;
    }
    const videoRect = video.getBoundingClientRect();
    const guideRect = guide.getBoundingClientRect();
    const scale = Math.min(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight);
    if (!scale) return false;

    const imageLeft = videoRect.left + (videoRect.width - video.videoWidth * scale) / 2;
    const imageTop = videoRect.top + (videoRect.height - video.videoHeight * scale) / 2;
    const sourceLeft = Math.max(0, Math.round((guideRect.left + guideRect.width * 0.08 - imageLeft) / scale));
    const sourceTop = Math.max(0, Math.round((guideRect.top + guideRect.height * 0.24 - imageTop) / scale));
    const sourceWidth = Math.min(video.videoWidth - sourceLeft, Math.round(guideRect.width * 0.84 / scale));
    const sourceHeight = Math.min(video.videoHeight - sourceTop, Math.round(guideRect.height * 0.42 / scale));
    if (sourceWidth <= 0 || sourceHeight <= 0) return false;

    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const context = canvas.getContext('2d', { willReadFrequently: false });
    if (!context) return false;
    context.drawImage(video, sourceLeft, sourceTop, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    return true;
  }
}

export function cameraErrorMessage(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return error instanceof Error ? error.message : 'No se pudo iniciar la cámara.';
  }
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
    return 'Permiso denegado. Autoriza la webcam en el navegador y vuelve a intentarlo.';
  }
  if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
    return 'No se encontró una cámara compatible. Conecta una webcam e inténtalo de nuevo.';
  }
  if (error.name === 'NotReadableError' || error.name === 'AbortError') {
    return 'La cámara está ocupada por otra aplicación. Ciérrala y vuelve a intentarlo.';
  }
  return 'No se pudo iniciar la cámara. Comprueba el dispositivo y sus permisos.';
}