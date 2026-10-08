// ===================================================================
// EXACT CONNECTION PROBLEM (update 37). Every game shows this instead of a vague "connection issue".
// explainTikTokError(err, username) -> one plain sentence that says WHAT failed, WHY it most likely failed
// and WHAT TO DO, followed by what TikTok / the library literally said.
// ===================================================================
import { tiktokStats } from "./tiktok-resilience.js";

const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

export function explainTikTokErrorParts(err, username) {
  const raw = clip((err && (err.message || err.info || err.name)) || err || "", 160);
  const m = (raw + " " + String((err && err.name) || "")).toLowerCase();
  const who = username ? "@" + String(username).replace(/^@/, "") : "that account";
  const keySet = tiktokStats().keyConfigured;
  const diag = err && err.tiktokDiagnosis;
  const P = (code, title, detail, fix) => ({ code, title, detail, fix, raw });

  if (/room ?id/.test(m)) {
    const p = diag && diag.probe;
    if (!keySet) return P("NO_KEY", "No signing key is set on the server", "TikTok could not be asked for the LIVE room without it.", "Add EULERSTREAM_API_KEY in Render > Environment, then redeploy.");
    if (p) {
      if (p.roomId) return P("LOOKUP_REFUSED", "TikTok shows " + who + " is LIVE, but the connection service would not give access to the room", "The room exists (id " + p.roomId + ") so the problem is the signing service or its limits, not your LIVE.", "Wait a minute and press Connect again. If it keeps happening, check your EulerStream key and its plan limits on eulerstream.com.");
      if (p.notFound) return P("NO_SUCH_USER", "TikTok says the account " + who + " does not exist", "TikTok's own profile page for that name was not found.", "Check the spelling of the username (letters, numbers, _ and . only, no spaces).");
      if (p.blocked) return P("TIKTOK_BLOCKS_SERVER", "TikTok is refusing this server's address (HTTP " + (p.status || "403") + " / robot check)", "Render's server address is being blocked from reading TikTok pages, so the live room cannot be looked up.", "Wait 10-30 minutes and try again. If it never works, the host address is blocked: redeploying on Render sometimes gives a new address.");
      if (p.networkError) return P("SERVER_OFFLINE", "This server cannot reach tiktok.com (" + p.networkError + ")", "The connection from your Render server to TikTok failed before any answer.", "Check Render's status page and try again in a few minutes.");
      if (p.userFound) return P("NOT_LIVE", who + " exists but is not LIVE right now", "TikTok shows the profile but no running LIVE room.", "Start your TikTok LIVE first (wait until it is actually on), then press Connect.");
    }
    return P("ROOM_ID", "TikTok did not return a LIVE room for " + who, "The account may not be LIVE yet, or TikTok / the signing service did not answer the room lookup.", "Make sure the LIVE is running, wait one minute, press Connect again. Open /api/tiktok-health?user=" + String(username || "NAME").replace(/^@/, "") + " on your site to see which one it is.");
  }
  if (/not currently live|isn'?t (currently )?(live|hosting)|not live|offline|live_not_found|has ended|stream ended/.test(m)) return P("NOT_LIVE", who + " is not LIVE right now", "TikTok says there is no running LIVE for that account.", "Start your TikTok LIVE first, then press Connect.");
  if (/invalid.*(unique|user)|unique.?id|user_not_found|no such user|does not exist|user not found/.test(m)) return P("BAD_USERNAME", "TikTok does not recognise the username " + who, "The name is misspelled or does not exist.", "Type the username without spaces (letters, numbers, _ and . only).");
  if (/402|payment required|quota|limit exceeded|plan limit|out of credits/.test(m)) return P("QUOTA", "Your EulerStream plan limit has been reached", "The signing service stopped answering because the key's quota is used up.", "Check your usage on eulerstream.com, wait for the reset or upgrade the plan.");
  if (/429|rate ?limit|too many request/.test(m)) return P("RATE_LIMIT", "Too many requests: TikTok or the signing service is rate-limiting this server", "Connecting was tried too often in a short time.", "Wait about 1-2 minutes before pressing Connect again.");
  if (/401|403|unauthori[sz]ed|forbidden|invalid.*(key|api)|api.?key|sign.*(fail|reject|denied)/.test(m)) return P("KEY_REJECTED", keySet ? "The signing service (EulerStream) rejected the request (HTTP 401/403)" : "No signing key is set on the server", keySet ? "The key is wrong, expired, disabled or not allowed for this feature." : "Without a key TikTok cannot be reached.", "Copy the key again from eulerstream.com into EULERSTREAM_API_KEY in Render > Environment, and redeploy.");
  if (/enotfound|eai_again|getaddrinfo/.test(m)) return P("DNS", "This server cannot find tiktok.com or the signing service (DNS lookup failed)", "A network problem on the server's side.", "Try again in a few minutes. If it persists, check Render's status page.");
  if (/econnrefused|econnreset|etimedout|timeout|timed out|socket hang up|fetch failed|network|aborted/.test(m)) return P("NETWORK", "The connection to TikTok / the signing service timed out or was cut", "Packets did not get through (network error from your server).", "Try again in a minute. If it keeps happening, check Render's status page.");
  if (/websocket|unexpected server response|\bws\b|1006|closed before|handshake/.test(m)) return P("WEBSOCKET", "TikTok refused the live chat websocket", "The chat channel could not be opened, usually because TikTok blocked the request or the signed link expired.", "Press Connect again. If it repeats, the server address may be limited by TikTok for a while.");
  if (/login|age.?restrict|private|geo|region|country|restricted/.test(m)) return P("RESTRICTED", "This LIVE has restrictions (login, age or region)", "TikTok will not show this LIVE to a logged-out server.", "Turn off the age / region restriction for your LIVE, or try again from a public LIVE.");
  if (/captcha|blocked|verify/.test(m)) return P("BLOCKED", "TikTok is blocking this server with a robot check", "TikTok answered with a verification page instead of the data.", "Wait 10-30 minutes, then try again.");
  return P("UNKNOWN", "An unrecognised connection error", "The connection failed for a reason this game does not know yet.", "Press Connect once more. If it repeats, send the 'TikTok said' text below.");
}

export function explainTikTokError(err, username) {
  const p = explainTikTokErrorParts(err, username);
  return p.title + ". " + p.detail + " What to do: " + p.fix + (p.raw ? " [TikTok said: " + p.raw + "]" : "");
}
