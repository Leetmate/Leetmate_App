import {
  GIFEncoder,
  quantize,
  applyPalette,
} from "https://unpkg.com/gifenc@1.0.3";

const ANIMALS = [
  { file: "CubicAraraAzul", name: "Arara Azul" },
  { file: "CubicBat", name: "Bat" },
  { file: "CubicBull", name: "Bull" },
  { file: "CubicBunny", name: "Bunny" },
  { file: "CubicCat", name: "Cat" },
  { file: "CubicChameleon", name: "Chameleon" },
  { file: "CubicChicken", name: "Chicken" },
  { file: "CubicCow", name: "Cow" },
  { file: "CubicDolphin", name: "Dolphin" },
  { file: "CubicDuck", name: "Duck" },
  { file: "CubicElephant", name: "Elephant" },
  { file: "CubicFish", name: "Fish" },
  { file: "CubicFlamingo", name: "Flamingo" },
  { file: "CubicFox", name: "Fox" },
  { file: "CubicFrog", name: "Frog" },
  { file: "CubicGiraffe", name: "Giraffe" },
  { file: "CubicGrizzly", name: "Grizzly" },
  { file: "CubicHorse", name: "Horse" },
  { file: "CubicJaguatirica", name: "Jaguatirica" },
  { file: "CubicLion", name: "Lion" },
  { file: "CubicLoboGuara", name: "Lobo Guara" },
  { file: "CubicMicoLeaoDourado", name: "Mico Leao Dourado" },
  { file: "CubicMonkey", name: "Monkey" },
  { file: "CubicMoose", name: "Moose" },
  { file: "CubicOwl", name: "Owl" },
  { file: "CubicPanda", name: "Panda" },
  { file: "CubicPenguin", name: "Penguin" },
  { file: "CubicPig", name: "Pig" },
  { file: "CubicPolar", name: "Polar" },
  { file: "CubicRacoon", name: "Racoon" },
  { file: "CubicRat", name: "Rat" },
  { file: "CubicRhino", name: "Rhino" },
  { file: "CubicSheep", name: "Sheep" },
  { file: "CubicShiba", name: "Shiba" },
  { file: "CubicSnake", name: "Snake" },
  { file: "CubicToucan", name: "Toucan" },
  { file: "CubicTurtle", name: "Turtle" },
  { file: "CubicUnicorn", name: "Unicorn" },
  { file: "CubicWolf", name: "Wolf" },
  { file: "CubicZebra", name: "Zebra" },
];

const SPRITE_PATH = "Animals - Outline/";
const FRAME_W = 21;
const FRAME_H = 16;
const EXPORT_SCALE = 4;
const EXPORT_FRAME_W = FRAME_W * EXPORT_SCALE;
const EXPORT_FRAME_H = FRAME_H * EXPORT_SCALE;

// Per Instructions.txt: frame 0+2=Idle, 0+1=Walk, 1=Jump, 2=Crouch, 3=Hit
const ANIMATION_FRAMES = {
  idle: [0, 2],
  walk: [0, 1],
  jump: [1],
  crouch: [2],
  hit: [3],
};

const listEl = document.getElementById("animalsList");
if (!listEl) throw new Error("animalsList element not found");

ANIMALS.forEach((animal) => {
  const url = SPRITE_PATH + animal.file + ".png";

  const row = document.createElement("div");
  row.className = "animal-row";
  row.innerHTML = `
    <div class="animal-header">
      <h3 class="animal-name">${animal.name} <span class="animal-file">(${animal.file}.png)</span></h3>
      <div class="animal-downloads">
        <label class="anim-label">
          Animation:
          <select class="anim-select" data-animal-file="${animal.file}">
            <option value="idle">Idle</option>
            <option value="walk">Walk</option>
            <option value="jump">Jump</option>
            <option value="crouch">Crouch</option>
            <option value="hit">Hit / Defeated</option>
          </select>
        </label>
        <button type="button" class="btn-gif btn-small" data-animal-file="${animal.file}" data-animal-name="${animal.name}">Download as GIF</button>
        <button type="button" class="btn-png btn-small" data-animal-file="${animal.file}" data-animal-name="${animal.name}">Download PNG (4×)</button>
      </div>
    </div>
    <div class="anim-grid">
      <div class="anim-card">
        <h4>Idle</h4>
        <div class="sprite-stage">
          <div class="sprite sprite-idle" style="background-image: url('${url}')"></div>
        </div>
      </div>
      <div class="anim-card">
        <h4>Walk</h4>
        <div class="sprite-stage">
          <div class="sprite sprite-walk" style="background-image: url('${url}')"></div>
        </div>
      </div>
      <div class="anim-card">
        <h4>Jump</h4>
        <div class="sprite-stage">
          <div class="sprite sprite-jump" style="background-image: url('${url}')"></div>
        </div>
      </div>
      <div class="anim-card">
        <h4>Crouch</h4>
        <div class="sprite-stage">
          <div class="sprite sprite-crouch" style="background-image: url('${url}')"></div>
        </div>
      </div>
      <div class="anim-card">
        <h4>Hit / Defeated</h4>
        <div class="sprite-stage">
          <div class="sprite sprite-hit" style="background-image: url('${url}')"></div>
        </div>
      </div>
    </div>
  `;
  listEl.appendChild(row);
});

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function getFrameImageData(img, frameIndex, scale) {
  const w = FRAME_W * scale;
  const h = FRAME_H * scale;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, frameIndex * FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

async function buildGif(animalFile, animalName, animationKey) {
  const frameIndices = ANIMATION_FRAMES[animationKey];
  if (!frameIndices || frameIndices.length === 0) return null;

  const url = SPRITE_PATH + animalFile + ".png";
  const img = await loadImage(url);

  const framesData = [];
  for (const fi of frameIndices) {
    framesData.push(getFrameImageData(img, fi, EXPORT_SCALE));
  }

  const pixelCount = EXPORT_FRAME_W * EXPORT_FRAME_H;
  const combined = new Uint8ClampedArray(framesData.length * pixelCount * 4);
  for (let i = 0; i < framesData.length; i++) {
    combined.set(framesData[i], i * pixelCount * 4);
  }

  const palette = quantize(combined, 256, {
    format: "rgba4444",
    oneBitAlpha: true,
  });
  const gif = GIFEncoder();
  const delay = frameIndices.length > 1 ? 400 : 600;

  for (let i = 0; i < framesData.length; i++) {
    const index = applyPalette(framesData[i], palette, "rgba4444");
    gif.writeFrame(index, EXPORT_FRAME_W, EXPORT_FRAME_H, {
      palette,
      delay,
      transparent: true,
      transparentIndex: 0,
    });
  }
  gif.finish();

  return new Blob([gif.bytes()], { type: "image/gif" });
}

listEl.addEventListener("click", async (e) => {
  const gifBtn = e.target.closest("button.btn-gif");
  if (gifBtn) {
    const file = gifBtn.dataset.animalFile;
    const name = gifBtn.dataset.animalName;
    const row = gifBtn.closest(".animal-row");
    const select = row.querySelector(".anim-select");
    const animationKey = select ? select.value : "idle";

    gifBtn.disabled = true;
    gifBtn.textContent = "Encoding…";
    try {
      const blob = await buildGif(file, name, animationKey);
      if (blob) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file + "-" + animationKey + ".gif";
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (err) {
      console.error(err);
    }
    gifBtn.disabled = false;
    gifBtn.textContent = "Download as GIF";
    return;
  }

  const pngBtn = e.target.closest("button.btn-png");
  if (pngBtn) {
    const file = pngBtn.dataset.animalFile;
    const url = SPRITE_PATH + file + ".png";

    pngBtn.disabled = true;
    pngBtn.textContent = "Preparing…";
    try {
      const img = await loadImage(url);
      const w = 84 * EXPORT_SCALE;
      const h = 16 * EXPORT_SCALE;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, 84, 16, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = file + ".png";
          a.click();
          URL.revokeObjectURL(a.href);
        },
        "image/png",
        1
      );
    } catch (err) {
      console.error(err);
    }
    pngBtn.disabled = false;
    pngBtn.textContent = "Download PNG (4×)";
  }
});
