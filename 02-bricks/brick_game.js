const canvas = document.querySelector("#game");
const context = canvas.getContext("2d");
const scoreLabel = document.querySelector("#score");
const message = document.querySelector("#message");

const { width, height } = canvas;
const carParts = [
  { name: "지붕", x: 315, y: 66, w: 278, h: 60, health: 6, color: "#a6dded", shape: "roof" },
  { name: "뒷문", x: 185, y: 144, w: 255, h: 64, health: 3, color: "#277eb5", shape: "door" },
  { name: "앞문", x: 460, y: 144, w: 178, h: 64, health: 1, color: "#2b8bc4", shape: "door" },
  { name: "보닛", x: 658, y: 144, w: 120, h: 64, health: 2, color: "#256f9f", shape: "hood" },
  { name: "뒷바퀴", x: 249, y: 226, w: 86, h: 86, health: 5, color: "#262d35", shape: "wheel" },
  { name: "앞바퀴", x: 630, y: 226, w: 86, h: 86, health: 4, color: "#262d35", shape: "wheel" },
];
const totalStages = carParts.length;
const stageLabel = document.querySelector("#level");
const progressLabel = document.querySelector("#progress");
const paddle = { x: 0, y: height - 28, width: 150, height: 14 };
const radius = 17;
const hammer = { x: 0, y: 0, dx: 0, dy: 0 };
const keys = new Set();
const mascotInterval = 12;
const mascotDuration = 1.6;

let parts;
let level = 1;
let broken;
let score = 0;
let stageStartScore = 0;
let elapsed;
let descent;
let state;

function updateHud() {
  stageLabel.textContent = level + " / " + totalStages;
  progressLabel.textContent = broken + " / " + level;
  scoreLabel.textContent = score;
}

function reset(startPlaying) {
  parts = carParts.map(part => ({ ...part, remaining: part.health }));
  broken = 0;
  score = stageStartScore;
  elapsed = 0;
  descent = 0;
  paddle.x = (width - paddle.width) / 2;
  hammer.x = width / 2;
  hammer.y = paddle.y - radius;
  hammer.dx = 0.13;
  hammer.dy = -Math.sqrt(1 - hammer.dx ** 2);
  state = startPlaying ? "playing" : "ready";
  message.hidden = startPlaying;
  updateHud();
}

function finish(result, instruction, nextState) {
  state = nextState;
  message.textContent = result + " · " + instruction;
  message.hidden = false;
}

function damage(part) {
  part.remaining--;
  if (part.remaining > 0) return;

  broken++;
  score += 10;
  updateHud();
  if (broken < level) return;

  if (level === totalStages) {
    finish("최종 승리! 모든 단계를 마쳤어요", "스페이스키로 처음부터", "won");
  } else {
    finish(level + "단계 클리어!", "스페이스키로 다음 단계", "cleared");
  }
}

function limit(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hammerSpeed(time) {
  return Math.min(680, 310 + time * 8);
}

function descentSpeed(time) {
  return Math.min(16, 2 + time * 0.25);
}

function hitPart(nextX, nextY) {
  for (const part of parts) {
    if (part.remaining === 0) continue;

    const top = part.y + descent;
    if (part.shape === "wheel") {
      const wheelRadius = part.w / 2;
      const centerX = part.x + wheelRadius;
      const centerY = top + wheelRadius;
      const dx = nextX - centerX;
      const dy = nextY - centerY;
      const distance = Math.hypot(dx, dy);
      const contactDistance = wheelRadius + radius;
      if (distance > contactDistance) continue;

      const normalX = distance ? dx / distance : -hammer.dx;
      const normalY = distance ? dy / distance : -hammer.dy;
      hammer.x = centerX + normalX * (contactDistance + 0.1);
      hammer.y = centerY + normalY * (contactDistance + 0.1);
      const descentRatio = descentSpeed(elapsed) / hammerSpeed(elapsed);
      const approach = hammer.dx * normalX + (hammer.dy - descentRatio) * normalY;
      if (approach >= 0) return true;

      const reflectedX = hammer.dx - 2 * approach * normalX;
      const reflectedY = hammer.dy - 2 * approach * normalY;
      const length = Math.hypot(reflectedX, reflectedY);
      hammer.dx = reflectedX / length;
      hammer.dy = reflectedY / length;
      damage(part);
      return true;
    }

    const nearestX = limit(nextX, part.x, part.x + part.w);
    const nearestY = limit(nextY, top, top + part.h);
    const offsetX = nextX - nearestX;
    const offsetY = nextY - nearestY;
    if (offsetX ** 2 + offsetY ** 2 > radius ** 2) continue;

    // 맞은 면 바깥으로 망치를 빼내 같은 접촉이 여러 번 계산되는 것을 막는다.
    if (Math.abs(offsetX) > Math.abs(offsetY)) {
      const side = Math.sign(offsetX);
      hammer.x = nearestX + side * (radius + 0.1);
      hammer.y = nextY;
      if (hammer.dx * side >= 0) return true;
      hammer.dx *= -1;
    } else {
      const side = Math.sign(offsetY || -hammer.dy || 1);
      hammer.x = nextX;
      hammer.y = nearestY + side * (radius + 0.1);
      const relativeY = hammer.dy * hammerSpeed(elapsed) - descentSpeed(elapsed);
      if (relativeY * side >= 0) return true;
      hammer.dy = side * Math.max(0.12, Math.abs(hammer.dy));
      hammer.dx = Math.sign(hammer.dx) * Math.sqrt(1 - hammer.dy ** 2);
    }
    damage(part);
    return true;
  }
  return false;
}

function update(dt) {
  elapsed += dt;
  descent += descentSpeed(elapsed) * dt;
  const direction = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
  paddle.x = limit(paddle.x + direction * 640 * dt, 0, width - paddle.width);

  const distance = hammerSpeed(elapsed) * dt;
  let nextX = hammer.x + hammer.dx * distance;
  let nextY = hammer.y + hammer.dy * distance;
  if (nextX < radius || nextX > width - radius) {
    hammer.dx = -hammer.dx;
    nextX = limit(nextX, radius, width - radius);
  }
  if (nextY < radius) {
    hammer.dy = Math.abs(hammer.dy);
    nextY = radius;
  }

  if (hammer.dy > 0 && hammer.y + radius <= paddle.y && nextY + radius >= paddle.y) {
    const contact = (paddle.y - radius - hammer.y) / (nextY - hammer.y);
    const contactX = hammer.x + (nextX - hammer.x) * contact;
    if (contactX >= paddle.x - radius && contactX <= paddle.x + paddle.width + radius) {
      const offset = (contactX - paddle.x - paddle.width / 2) / (paddle.width / 2);
      const angle = limit(offset, -1, 1) * 1.05;
      hammer.dx = Math.sin(angle);
      hammer.dy = -Math.cos(angle);
      nextX = contactX;
      nextY = paddle.y - radius;
    }
  }

  if (!hitPart(nextX, nextY)) {
    hammer.x = nextX;
    hammer.y = nextY;
  }

  if (state !== "playing") return;
  if (hammer.y - radius >= height) {
    finish("망치를 놓쳤어요", "스페이스키로 같은 단계 다시 시작", "lost");
  } else if (parts.some(part => part.remaining > 0 && part.y + descent + part.h >= paddle.y)) {
    finish("자동차가 바 높이까지 내려왔어요", "스페이스키로 같은 단계 다시 시작", "lost");
  }
}

function outlinedRect(x, y, w, h, color) {
  context.fillStyle = "#000";
  context.fillRect(x, y, w, h);
  context.fillStyle = color;
  context.fillRect(x + 2, y + 2, w - 4, h - 4);
}

function circle(x, y, r, color) {
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2);
  context.fill();
}

function drawMascot() {
  if (elapsed < mascotInterval) return;
  const phase = elapsed % mascotInterval;
  if (phase >= mascotDuration) return;

  // 캐릭터를 마지막에 그려 잠깐 화면을 가린다. 망치의 움직임에는 영향을 주지 않는다.
  const visit = Math.floor(elapsed / mascotInterval);
  const position = -70 + (width + 140) * phase / mascotDuration;
  const x = visit % 2 === 0 ? width - position : position;
  const y = 392 + Math.sin(phase * 10) * 17;
  circle(x - 29, y - 31, 20, "#4c2776");
  circle(x + 29, y - 31, 20, "#4c2776");
  circle(x, y, 55, "#4c2776");
  circle(x, y, 51, "#a77be0");
  circle(x - 16, y - 8, 6, "#181818");
  circle(x + 16, y - 8, 6, "#181818");
  circle(x, y + 13, 9, "#fff");
}

function drawPart(part) {
  const top = part.y + descent;
  const centerX = part.x + part.w / 2;
  const centerY = top + part.h / 2;

  if (part.shape === "wheel") {
    circle(centerX, centerY, 43, "#121820");
    circle(centerX, centerY, 35, part.color);
    circle(centerX, centerY, 28, "#526172");
  } else {
    outlinedRect(part.x, top, part.w, part.h, part.color);
    if (part.shape === "roof") {
      outlinedRect(centerX - 3, top + 2, 6, part.h - 4, "#304c63");
      context.fillStyle = "#d3f1fa";
      context.fillRect(part.x + 12, top + 9, part.w / 2 - 24, 5);
    } else {
      context.fillStyle = part.shape === "hood" ? "#ffdd75" : "#bde8ff";
      context.fillRect(part.x + part.w - 35, top + 11, 22, 6);
    }
  }

  context.fillStyle = part.shape === "roof" ? "#172b3e" : "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "bold 14px system-ui, sans-serif";
  context.fillText(part.name, centerX, centerY - 8);
  context.font = "12px system-ui, sans-serif";
  context.fillText(part.remaining + " / " + part.health, centerX, centerY + 11);
}

function drawHammer() {
  context.save();
  context.translate(hammer.x, hammer.y);
  context.rotate(-0.45 + elapsed * 8);
  outlinedRect(-4, -3, 8, 19, "#b87338");
  outlinedRect(-15, -12, 30, 13, "#aab9ca");
  context.fillStyle = "#e8eff5";
  context.fillRect(-11, -9, 21, 2);
  context.restore();
}

function draw() {
  context.clearRect(0, 0, width, height);
  for (const part of parts) {
    if (part.remaining > 0) drawPart(part);
  }
  outlinedRect(paddle.x, paddle.y, paddle.width, paddle.height, "#23a455");
  drawHammer();
  if (state === "playing") drawMascot();
}

window.addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) return;
  event.preventDefault();
  if (event.code === "Space") {
    if (event.repeat || state === "playing") return;
    if (state === "cleared") {
      level++;
      stageStartScore = score;
    } else if (state === "won") {
      level = 1;
      stageStartScore = 0;
    }
    reset(true);
  } else {
    keys.add(event.code);
  }
});

window.addEventListener("keyup", event => keys.delete(event.code));
window.addEventListener("blur", () => keys.clear());

let previousTime;
let remaining = 0;
const step = 1 / 240;

function frame(time) {
  if (state === "playing" && previousTime !== undefined) {
    remaining += Math.min((time - previousTime) / 1000, 0.05);
    // 짧은 간격으로 나눠 계산해 빨라진 망치도 부품을 건너뛰지 않게 한다.
    while (remaining >= step && state === "playing") {
      update(step);
      remaining -= step;
    }
  } else {
    remaining = 0;
  }
  previousTime = time;
  draw();
  requestAnimationFrame(frame);
}

reset(false);
requestAnimationFrame(frame);
