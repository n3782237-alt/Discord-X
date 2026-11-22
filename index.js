require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { randomInt, randomBytes, createHash } = require("crypto");
const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");
const { z } = require("zod");

const prisma = new PrismaClient();
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: true, credentials: true } });
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("Set JWT_SECRET to a random string of at least 32 characters in server/.env");
  process.exit(1);
}
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const hash = value => createHash("sha256").update(value).digest("hex");
const sign = user => jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const data = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: data.sub } });
    if (!user) return res.status(401).json({ error: "Session not found" });
    req.user = user; next();
  } catch { res.status(401).json({ error: "Please sign in again" }); }
}
async function sendCode(email, code) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log(`[DEV ONLY] Verification code for ${email}: ${code}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST, port: Number(SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE) === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER, to: email,
    subject: "Your Discord X verification code",
    text: `Your Discord X verification code is ${code}. It expires in 10 minutes.`
  });
}
app.get("/api/health", (_req, res) => res.json({ ok: true, app: "Discord X" }));

app.post("/api/auth/register", async (req, res) => {
  const parsed = z.object({
    email: z.string().email().max(254),
    username: z.string().min(2).max(24).regex(/^[\p{L}\p{N}_ .-]+$/u),
    password: z.string().min(8).max(72)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Check email, username and password (8+ characters)." });
  const { email, username, password } = parsed.data;
  try {
    if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: "This email is already registered." });
    const passwordHash = await bcrypt.hash(password, 12);
    const code = String(randomInt(100000, 1000000));
    await prisma.verificationCode.deleteMany({ where: { email } });
    await prisma.verificationCode.create({ data: { email, codeHash: hash(code), expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
    await prisma.user.create({ data: { email, username, passwordHash, verified: false } });
    try { await sendCode(email, code); }
    catch (e) { await prisma.user.delete({ where: { email } }); throw e; }
    res.json({ ok: true, message: "Verification code sent. Check your email." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not create account. Check SMTP configuration and server logs." });
  }
});
app.post("/api/auth/verify", async (req, res) => {
  const parsed = z.object({ email: z.string().email(), code: z.string().length(6) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter the six-digit code." });
  const { email, code } = parsed.data;
  const record = await prisma.verificationCode.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
  if (!record || record.expiresAt < new Date() || record.codeHash !== hash(code))
    return res.status(400).json({ error: "Code is incorrect or expired." });
  const user = await prisma.user.update({ where: { email }, data: { verified: true } });
  await prisma.verificationCode.deleteMany({ where: { email } });
  res.json({ token: sign(user), user: { id: user.id, username: user.username, email: user.email, coins: user.coins, tier: user.tier } });
});
app.post("/api/auth/login", async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and password." });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ error: "Incorrect email or password." });
  if (!user.verified) return res.status(403).json({ error: "Verify your email before signing in." });
  res.json({ token: sign(user), user: { id: user.id, username: user.username, email: user.email, coins: user.coins, tier: user.tier } });
});
app.get("/api/me", auth, (req, res) => res.json({ id: req.user.id, username: req.user.username, email: req.user.email, coins: req.user.coins, tier: req.user.tier }));
app.get("/api/servers", auth, async (req, res) => {
  const memberships = await prisma.membership.findMany({
    where: { userId: req.user.id },
    include: { server: { include: { channels: true } } }
  });
  res.json(memberships.map(m => m.server));
});
app.post("/api/servers", auth, async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 50);
  if (name.length < 2) return res.status(400).json({ error: "Server name must contain at least 2 characters." });
  const server = await prisma.server.create({ data: {
    name, ownerId: req.user.id,
    channels: { create: [{ name: "general", type: "TEXT" }, { name: "voice", type: "VOICE" }] },
    members: { create: { userId: req.user.id } }
  }, include: { channels: true } });
  res.json(server);
});
app.post("/api/servers/:id/channels", auth, async (req, res) => {
  const membership = await prisma.membership.findUnique({ where: { userId_serverId: { userId: req.user.id, serverId: req.params.id } } });
  if (!membership) return res.status(403).json({ error: "You are not a member of this server." });
  const name = String(req.body.name || "").trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").slice(0, 40);
  const type = req.body.type === "VOICE" ? "VOICE" : "TEXT";
  if (name.length < 2) return res.status(400).json({ error: "Channel name is too short." });
  const channel = await prisma.channel.create({ data: { name, type, serverId: req.params.id } });
  res.json(channel);
});
app.get("/api/channels/:id/messages", auth, async (req, res) => {
  const channel = await prisma.channel.findUnique({ where: { id: req.params.id }, include: { server: true } });
  if (!channel) return res.status(404).json({ error: "Channel not found." });
  const member = await prisma.membership.findUnique({ where: { userId_serverId: { userId: req.user.id, serverId: channel.serverId } } });
  if (!member) return res.status(403).json({ error: "Not a member." });
  const messages = await prisma.message.findMany({ where: { channelId: channel.id }, orderBy: { createdAt: "asc" }, take: 100, include: { user: { select: { username: true } } } });
  res.json(messages);
});
app.post("/api/billing/demo-purchase", auth, async (req, res) => {
  const tier = req.body.tier;
  const accepted = req.body.accepted === true;
  const prices = { PREMIUM: 500, PRO: 1000 };
  if (!accepted) return res.status(400).json({ error: "You must accept the purchase terms and policies." });
  if (!prices[tier]) return res.status(400).json({ error: "Unknown plan." });
  if (req.user.coins < prices[tier]) return res.status(400).json({ error: "Not enough X-Coins." });
  const result = await prisma.$transaction(async tx => {
    const updated = await tx.user.update({
      where: { id: req.user.id },
      data: { coins: { decrement: prices[tier] }, tier }
    });
    const purchase = await tx.purchase.create({ data: {
      userId: req.user.id, tier, amountCoins: prices[tier], previousTier: req.user.tier
    }});
    return { updated, purchase };
  });
  res.json({
    purchaseId: result.purchase.id, coins: result.updated.coins, tier: result.updated.tier,
    refundDeadline: new Date(result.purchase.createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    message: "Demo subscription activated. A refund request is available for 24 hours."
  });
});
app.post("/api/billing/refund", auth, async (req, res) => {
  const purchaseId = String(req.body.purchaseId || "");
  if (!purchaseId) return res.status(400).json({ error: "Purchase ID is required." });
  try {
    const result = await prisma.$transaction(async tx => {
      const purchase = await tx.purchase.findFirst({ where: { id: purchaseId, userId: req.user.id } });
      if (!purchase) throw new Error("PURCHASE_NOT_FOUND");
      if (purchase.refundedAt) throw new Error("ALREADY_REFUNDED");
      if (Date.now() > purchase.createdAt.getTime() + 24 * 60 * 60 * 1000) throw new Error("REFUND_WINDOW_EXPIRED");
      await tx.purchase.update({ where: { id: purchase.id }, data: { refundedAt: new Date() } });
      const user = await tx.user.update({
        where: { id: req.user.id },
        data: { coins: { increment: purchase.amountCoins }, tier: purchase.previousTier }
      });
      return user;
    });
    res.json({ ok: true, coins: result.coins, tier: result.tier, message: "Demo X-Coins have been returned to your wallet." });
  } catch (e) {
    const errors = {
      PURCHASE_NOT_FOUND: [404, "Purchase not found."],
      ALREADY_REFUNDED: [409, "This purchase has already been refunded."],
      REFUND_WINDOW_EXPIRED: [400, "The 24-hour refund window has expired."]
    };
    const [status, message] = errors[e.message] || [500, "Could not process refund."];
    res.status(status).json({ error: message });
  }
});

const socketUser = new Map();
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const data = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: data.sub } });
    if (!user || !user.verified) return next(new Error("Unauthorized"));
    socketUser.set(socket.id, user);
    next();
  } catch { next(new Error("Unauthorized")); }
});
io.on("connection", socket => {
  const user = socketUser.get(socket.id);
  socket.on("channel:join", async channelId => {
    const channel = await prisma.channel.findUnique({ where: { id: String(channelId) } });
    if (!channel) return;
    const member = await prisma.membership.findUnique({ where: { userId_serverId: { userId: user.id, serverId: channel.serverId } } });
    if (member) socket.join(`channel:${channel.id}`);
  });
  socket.on("message:send", async payload => {
    try {
      const channelId = String(payload?.channelId || "");
      const content = String(payload?.content || "").trim().slice(0, 4000);
      if (!content) return;
      const channel = await prisma.channel.findUnique({ where: { id: channelId } });
      if (!channel) return;
      const member = await prisma.membership.findUnique({ where: { userId_serverId: { userId: user.id, serverId: channel.serverId } } });
      if (!member) return;
      const message = await prisma.message.create({ data: { channelId, userId: user.id, content }, include: { user: { select: { username: true } } } });
      io.to(`channel:${channelId}`).emit("message:new", message);
    } catch (e) { console.error("message error", e); }
  });
  // WebRTC signaling: clients must join a voice room before exchanging offers/ICE.
  socket.on("call:join", room => {
    const safeRoom = String(room || "").slice(0, 100);
    if (!safeRoom) return;
    socket.join(`call:${safeRoom}`);
    socket.to(`call:${safeRoom}`).emit("call:peer-joined", { socketId: socket.id, username: user.username });
  });
  socket.on("call:leave", room => {
    const r = `call:${String(room || "").slice(0, 100)}`;
    socket.to(r).emit("call:peer-left", { socketId: socket.id });
    socket.leave(r);
  });
  for (const event of ["call:offer", "call:answer", "call:ice"]) {
    socket.on(event, data => {
      const room = `call:${String(data?.room || "").slice(0, 100)}`;
      socket.to(room).emit(event, { ...data, from: socket.id });
    });
  }
  socket.on("disconnect", () => socketUser.delete(socket.id));
});
httpServer.listen(PORT, () => console.log(`Discord X API listening on http://localhost:${PORT}`));
