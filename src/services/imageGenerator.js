import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.resolve(__dirname, "../../assets/fonts");

const ARABIC_FONT_FAMILY = "Noto Sans Arabic";
const LATIN_FONT_FAMILY = "Noto Sans";

let fontsRegistered = false;

/**
 * Registers the bundled fonts with the canvas engine. Safe to call repeatedly.
 * Falls back gracefully (with a console warning) if the font files are missing —
 * see README "Troubleshooting -> Arabic font not loading" for setup instructions.
 */
function ensureFontsRegistered() {
  if (fontsRegistered) return;
  fontsRegistered = true;

  const arabicPath = path.join(FONTS_DIR, "NotoSansArabic-Regular.ttf");
  const arabicBoldPath = path.join(FONTS_DIR, "NotoSansArabic-Bold.ttf");
  const latinPath = path.join(FONTS_DIR, "NotoSans-Regular.ttf");
  const latinBoldPath = path.join(FONTS_DIR, "NotoSans-Bold.ttf");

  for (const [file, family] of [
    [arabicPath, ARABIC_FONT_FAMILY],
    [arabicBoldPath, ARABIC_FONT_FAMILY],
    [latinPath, LATIN_FONT_FAMILY],
    [latinBoldPath, LATIN_FONT_FAMILY]
  ]) {
    if (fs.existsSync(file)) {
      GlobalFonts.registerFromPath(file, family);
    } else {
      console.warn(
        `[ImageGenerator] Font file not found: ${file}. Arabic/Latin text may fall back to a system font. ` +
          `See README troubleshooting section.`
      );
    }
  }
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

async function drawCircularAvatar(ctx, avatarURL, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  try {
    const image = await loadImage(avatarURL);
    ctx.drawImage(image, x, y, size, size);
  } catch (err) {
    // Offline-safe fallback: solid circle with initial letter, never throws.
    ctx.fillStyle = "#5865F2";
    ctx.fillRect(x, y, size, size);
  }

  ctx.restore();

  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#ffffff33";
  ctx.stroke();
}

/**
 * Renders a modern invite-progress card as a PNG buffer.
 *
 * @param {object} opts
 * @param {string} opts.username - display name shown on the card.
 * @param {string} opts.avatarURL - direct URL to the member's avatar (png/jpg).
 * @param {number} opts.validInviteCount - total valid invites.
 * @param {object|null} opts.nextReward - { name, requiredInvites } or null if maxed out.
 * @param {string|null} opts.lastInvitedUsername - display name of the last person they invited.
 */
export async function generateInviteCard({
  username,
  avatarURL,
  validInviteCount,
  nextReward,
  lastInvitedUsername
}) {
  ensureFontsRegistered();

  const width = 1000;
  const height = 420;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#1e1f3b");
  bg.addColorStop(1, "#2b2d5e");
  ctx.fillStyle = bg;
  drawRoundedRect(ctx, 0, 0, width, height, 28);
  ctx.fill();

  // Decorative accent bar
  ctx.fillStyle = "#5865F2";
  drawRoundedRect(ctx, 0, 0, 12, height, 6);
  ctx.fill();

  // Avatar
  const avatarSize = 140;
  const avatarX = 50;
  const avatarY = 50;
  await drawCircularAvatar(ctx, avatarURL, avatarX, avatarY, avatarSize);

  // Username
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 36px "${LATIN_FONT_FAMILY}", "${ARABIC_FONT_FAMILY}"`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(username, avatarX + avatarSize + 30, 60);

  // Big valid invite count
  ctx.fillStyle = "#7dd3fc";
  ctx.font = `bold 72px "${LATIN_FONT_FAMILY}"`;
  ctx.fillText(String(validInviteCount), avatarX + avatarSize + 30, 105);

  // Arabic summary line: "مجموع دعواتك: 55"
  ctx.fillStyle = "#e5e7eb";
  ctx.font = `28px "${ARABIC_FONT_FAMILY}"`;
  ctx.textAlign = "right";
  ctx.fillText(`مجموع دعواتك: ${validInviteCount}`, width - 50, 60);

  // Remaining-to-next-reward line
  const remaining = nextReward ? Math.max(nextReward.requiredInvites - validInviteCount, 0) : 0;
  const remainingLine = nextReward
    ? `باقي لك ${remaining} دعوة للمكافأة التالية`
    : "لقد وصلت لأعلى مكافأة متاحة!";
  ctx.font = `24px "${ARABIC_FONT_FAMILY}"`;
  ctx.fillText(remainingLine, width - 50, 100);

  // Next reward name
  const nextRewardLine = nextReward
    ? `المكافأة التالية: ${nextReward.name}`
    : "لا توجد مكافآت إضافية حالياً";
  ctx.font = `24px "${ARABIC_FONT_FAMILY}"`;
  ctx.fillStyle = "#facc15";
  ctx.fillText(nextRewardLine, width - 50, 135);

  // Progress bar
  const barX = 50;
  const barY = 240;
  const barWidth = width - 100;
  const barHeight = 34;
  const progressTarget = nextReward ? nextReward.requiredInvites : Math.max(validInviteCount, 1);
  const progressRatio = Math.min(validInviteCount / progressTarget, 1);
  const percentage = Math.round(progressRatio * 100);

  ctx.fillStyle = "#00000055";
  drawRoundedRect(ctx, barX, barY, barWidth, barHeight, 17);
  ctx.fill();

  if (progressRatio > 0) {
    const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    gradient.addColorStop(0, "#22d3ee");
    gradient.addColorStop(1, "#6366f1");
    ctx.fillStyle = gradient;
    drawRoundedRect(ctx, barX, barY, Math.max(barWidth * progressRatio, barHeight), barHeight, 17);
    ctx.fill();
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 18px "${LATIN_FONT_FAMILY}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${percentage}%`, barX + barWidth / 2, barY + barHeight / 2 + 1);

  // Last invited user
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#9ca3af";
  ctx.font = `20px "${ARABIC_FONT_FAMILY}"`;
  const lastInvitedLine = lastInvitedUsername
    ? `آخر شخص قمت بدعوته: ${lastInvitedUsername}`
    : "لم تقم بدعوة أحد بعد";
  ctx.fillText(lastInvitedLine, width - 50, barY + barHeight + 45);

  return canvas.encode("png");
}

export default { generateInviteCard };
