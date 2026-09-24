import * as THREE from "three";

const COPIED_LABEL_DURATION = 1200;

function formatNumber(value) {
  return value.toFixed(4);
}

function formatDegrees(value) {
  return `${THREE.MathUtils.radToDeg(value).toFixed(2)} deg`;
}

function vectorToObject(vector) {
  return {
    x: Number(vector.x.toFixed(6)),
    y: Number(vector.y.toFixed(6)),
    z: Number(vector.z.toFixed(6)),
  };
}

function quaternionToObject(quaternion) {
  return {
    x: Number(quaternion.x.toFixed(6)),
    y: Number(quaternion.y.toFixed(6)),
    z: Number(quaternion.z.toFixed(6)),
    w: Number(quaternion.w.toFixed(6)),
  };
}

export function createSceneControls({
  camera,
  isFreeCameraEnabled = () => false,
  onToggleFreeCamera = null,
} = {}) {
  if (!camera) {
    throw new Error("createSceneControls requires a camera.");
  }

  const panel = document.createElement("section");
  panel.className = "camera-controls";
  panel.innerHTML = `
    <div class="camera-controls__header">
      <span>Camera</span>
      <div class="camera-controls__actions">
        <button
          type="button"
          class="camera-controls__button camera-controls__button--toggle"
          data-free-camera-toggle
          aria-pressed="false"
        >Free Camera</button>
        <button type="button" class="camera-controls__button" data-camera-copy>Copy</button>
      </div>
    </div>
    <div class="camera-controls__grid">
      <span>Position</span>
      <code data-camera-position></code>
      <span>Rotation</span>
      <code data-camera-rotation></code>
      <span>FOV</span>
      <div class="camera-controls__slider">
        <input data-camera-fov type="range" min="20" max="100" step="0.1">
        <code data-camera-fov-value></code>
      </div>
    </div>
  `;

  const positionValue = panel.querySelector("[data-camera-position]");
  const rotationValue = panel.querySelector("[data-camera-rotation]");
  const fovInput = panel.querySelector("[data-camera-fov]");
  const fovValue = panel.querySelector("[data-camera-fov-value]");
  const copyButton = panel.querySelector("[data-camera-copy]");
  const freeCameraButton = panel.querySelector("[data-free-camera-toggle]");
  let copiedLabelTimer = null;

  function getCameraParams() {
    return {
      transform: {
        position: vectorToObject(camera.position),
        rotation: {
          x: Number(camera.rotation.x.toFixed(6)),
          y: Number(camera.rotation.y.toFixed(6)),
          z: Number(camera.rotation.z.toFixed(6)),
          order: camera.rotation.order,
        },
        quaternion: quaternionToObject(camera.quaternion),
        scale: vectorToObject(camera.scale),
      },
      fov: Number(camera.fov.toFixed(4)),
    };
  }

  async function copyCameraParams() {
    const text = JSON.stringify(getCameraParams(), null, 2);

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    copyButton.textContent = "Copied";
    window.clearTimeout(copiedLabelTimer);
    copiedLabelTimer = window.setTimeout(() => {
      copyButton.textContent = "Copy";
    }, COPIED_LABEL_DURATION);
  }

  function update() {
    const freeCameraEnabled = Boolean(isFreeCameraEnabled());

    positionValue.textContent = [
      formatNumber(camera.position.x),
      formatNumber(camera.position.y),
      formatNumber(camera.position.z),
    ].join(", ");
    rotationValue.textContent = [
      formatDegrees(camera.rotation.x),
      formatDegrees(camera.rotation.y),
      formatDegrees(camera.rotation.z),
    ].join(", ");
    fovInput.value = camera.fov;
    fovValue.textContent = camera.fov.toFixed(2);
    freeCameraButton.textContent = freeCameraEnabled
      ? "Animated Camera"
      : "Free Camera";
    freeCameraButton.setAttribute("aria-pressed", String(freeCameraEnabled));
  }

  fovInput.addEventListener("input", (event) => {
    camera.fov = Number(event.target.value);
    camera.updateProjectionMatrix();
    update();
  });

  copyButton.addEventListener("click", () => {
    copyCameraParams().catch(() => {
      copyButton.textContent = "Failed";
      window.clearTimeout(copiedLabelTimer);
      copiedLabelTimer = window.setTimeout(() => {
        copyButton.textContent = "Copy";
      }, COPIED_LABEL_DURATION);
    });
  });

  freeCameraButton.addEventListener("click", () => {
    onToggleFreeCamera?.(!isFreeCameraEnabled());
    update();
  });

  panel.addEventListener("pointerdown", (event) => event.stopPropagation());
  panel.addEventListener("wheel", (event) => event.stopPropagation(), {
    passive: true,
  });
  document.body.appendChild(panel);
  update();

  return {
    element: panel,
    update,
  };
}
