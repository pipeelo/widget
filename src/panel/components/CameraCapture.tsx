import { useEffect, useRef, useState } from 'preact/hooks';
import { cameraPolicyBlocked, capturePhoto, openCamera, warnCamera } from '../lib/camera';
import { mediaErrorKind, type MediaError } from '../lib/policy';
import { STR } from '../lib/strings';
import { useEscape } from '../state/useEscape';
import { CloseIcon } from './icons';

export function CameraCapture(props: {
  onCapture(file: File): void;
  onError(kind: MediaError): void;
  onClose(): void;
}) {
  const [ready, setReady] = useState(false);
  const [shooting, setShooting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEscape(() => propsRef.current.onClose());

  useEffect(() => {
    closeRef.current?.focus();
    if (cameraPolicyBlocked()) {
      warnCamera(null);
      propsRef.current.onError('blocked');
      propsRef.current.onClose();
      return;
    }
    let cancelled = false;
    openCamera().then(
      (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          void video.play().catch(() => {});
        }
      },
      (err: unknown) => {
        if (cancelled) return;
        warnCamera(err);
        propsRef.current.onError(mediaErrorKind(err, cameraPolicyBlocked()));
        propsRef.current.onClose();
      }
    );
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const shoot = () => {
    const video = videoRef.current;
    if (!video || shooting) return;
    setShooting(true);
    void capturePhoto(video).then((file) => {
      if (!streamRef.current) return;
      if (file) props.onCapture(file);
      else props.onError('failed');
    });
  };

  return (
    <div class="camera" role="dialog" aria-modal="true" aria-label={STR.attachCamera}>
      <div class="camera-head">
        <span class="camera-title">{ready ? STR.attachCamera : STR.cameraOpening}</span>
        <button
          ref={closeRef}
          type="button"
          class="camera-close"
          aria-label={STR.previewCancel}
          onClick={props.onClose}
        >
          <CloseIcon />
        </button>
      </div>
      <div class="camera-body">
        <video
          ref={videoRef}
          class="camera-video"
          autoplay
          playsInline
          muted
          onLoadedMetadata={() => setReady(true)}
        />
      </div>
      <div class="camera-foot">
        <button
          type="button"
          class="camera-shutter"
          aria-label={STR.takePhoto}
          disabled={!ready || shooting}
          onClick={shoot}
        />
      </div>
    </div>
  );
}
