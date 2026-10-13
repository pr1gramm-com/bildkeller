// End-to-end seed + smoke test over the public HTTP API.
// Usage: BASE_URL=http://localhost:3000 node scripts/seed.mjs   (needs an EMPTY instance: first account becomes admin)
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

class Client {
  cookie = "";
  nonce = "";
  async call(path, { method = "GET", form, body } = {}) {
    const init = { method, headers: { cookie: this.cookie } };
    if (form) init.body = new URLSearchParams({ ...form, ...(this.nonce ? { _nonce: this.nonce } : {}) });
    if (body) init.body = body;
    const res = await fetch(`${BASE}/api/${path}`, init);
    for (const c of res.headers.getSetCookie()) {
      const me = c.match(/^me=([^;]*)/);
      if (me) {
        this.cookie = me[1] ? `me=${me[1]}` : "";
        const map = me[1] ? JSON.parse(Buffer.from(me[1], "base64url").toString()) : {};
        this.nonce = (map.id ?? "").slice(0, 16);
      }
    }
    const json = await res.json();
    if (json.error) throw new Error(`${path}: ${json.error}`);
    return json;
  }
}

async function png(i) {
  const hue = (i * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="100%" height="100%" fill="hsl(${hue},60%,45%)"/><text x="50%" y="55%" font-size="120" fill="white" text-anchor="middle" font-family="sans-serif">${i}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function upload(c, i, rating, tags) {
  const fd = new FormData();
  fd.append("image", new Blob([await png(i)], { type: "image/png" }), `seed${i}.png`);
  const { key } = await c.call("items/upload", { method: "POST", body: fd });
  return c.call("items/post", { method: "POST", form: { key, sfwstatus: rating, tags } });
}

const admin = new Client();
await admin.call("user/joinwithinvite", { method: "POST", form: { name: "admin", password: "admin-password", ageVerified: "1" } });
console.log("admin created (first account)");

const users = [];
for (const name of ["alice", "bob"]) {
  const { code } = await admin.call("user/invite", { method: "POST", form: {} });
  const c = new Client();
  await c.call("user/joinwithinvite", { method: "POST", form: { name, password: "demo-password", invite: code, ageVerified: "1" } });
  users.push(c);
}
const [alice, bob] = users;

const itemIds = [];
for (let i = 1; i <= 12; i++) {
  const owner = [admin, alice, bob][i % 3];
  const { itemId } = await upload(owner, i, i % 5 === 0 ? "nsfp" : "sfw", `demo, farbe${i % 4}`);
  itemIds.push(itemId);
}
console.log(`${itemIds.length} items uploaded`);

for (const id of itemIds.slice(0, 6)) {
  for (const voter of [admin, alice, bob]) await voter.call("items/vote", { method: "POST", form: { id, up: 1 } }).catch(() => {});
}
const { commentId } = await alice.call("comments/post", { method: "POST", form: { itemId: itemIds[0], parent: 0, content: "Willkommen im Keller, @bob" } });
await bob.call("comments/post", { method: "POST", form: { itemId: itemIds[0], parent: commentId, content: "danke!" } });
await bob.call("profile/follow", { method: "POST", form: { name: "alice" } });
await alice.call("inbox/post", { method: "POST", form: { to: "bob", comment: "Hallo Bob" } });
await alice.call("collections/create", { method: "POST", form: { name: "Meine Lieblinge" } });

const feed = await admin.call("items/get?flags=31&promoted=0");
const top = await admin.call("items/get?flags=31&promoted=1");
const search = await admin.call("items/get?flags=31&tags=" + encodeURIComponent("! demo -farbe1"));
if (feed.items.length !== 12) throw new Error(`feed expected 12 items, got ${feed.items.length}`);
if (top.items.length === 0) throw new Error("promotion did not trigger");
if (search.items.length === 0) throw new Error("search returned nothing");
const sync = await bob.call("user/sync?offset=0");
if (sync.inbox.messages !== 1 || sync.inbox.mentions !== 1) throw new Error(`inbox counters off: ${JSON.stringify(sync.inbox)}`);
console.log(`OK — feed ${feed.items.length}, promoted ${top.items.length}, search ${search.items.length}, bob inbox ${JSON.stringify(sync.inbox)}`);
