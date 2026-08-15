import { useEffect, useRef } from "react";
import { Camera, LockKeyhole } from "lucide-react";
import { useLumina } from "@/app/LuminaProvider";

export function CameraPreview() {
  const { cameraActive, mode, preferences, status, videoRef } = useLumina();
  const previewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview || !videoRef.current?.srcObject) return;
    preview.srcObject = videoRef.current.srcObject;
    void preview.play();
    return () => { preview.srcObject = null; };
  }, [cameraActive, videoRef]);

  if (!cameraActive || mode !== "camera" || !preferences.cameraPreview) return null;

  return (
    <aside className="camera-preview-float" aria-label="Active local camera preview">
      <video ref={previewRef} muted playsInline className={preferences.mirrorVideo ? "is-mirrored" : ""} />
      <div><span><Camera aria-hidden="true" /> Camera Active</span><strong>{status === "active" ? "Tracking" : status.replace(/-/g, " ")}</strong></div>
      <small><LockKeyhole aria-hidden="true" /> Processing locally</small>
    </aside>
  );
}
