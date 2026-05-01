import { NS } from "./statusModel.js";

const LEADER_STORAGE_KEY = `${NS}/animation-leader`;
const LEADER_HEARTBEAT_MS = 500;
const LEADER_TIMEOUT_MS = 1600;
const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let leaderHeartbeatId = 0;
let leaderState = false;
let leaderChangeHandler = null;

function now() {
  return Date.now();
}

function safeParse(value) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readLeaderLease() {
  return safeParse(window.localStorage.getItem(LEADER_STORAGE_KEY));
}

function writeLeaderLease() {
  window.localStorage.setItem(
    LEADER_STORAGE_KEY,
    JSON.stringify({
      tabId: TAB_ID,
      timestamp: now(),
    }),
  );
}

function clearLeaderLease() {
  const lease = readLeaderLease();
  if (lease?.tabId !== TAB_ID) return;
  window.localStorage.removeItem(LEADER_STORAGE_KEY);
}

function isLeaseActive(lease) {
  if (!lease?.tabId || !Number.isFinite(lease?.timestamp)) {
    return false;
  }

  return now() - lease.timestamp < LEADER_TIMEOUT_MS;
}

function setLeaderState(nextState) {
  const normalizedNextState = Boolean(nextState);
  if (leaderState === normalizedNextState) return;
  leaderState = normalizedNextState;
  leaderChangeHandler?.(leaderState);
}

function claimLeadership() {
  const lease = readLeaderLease();

  if (!isLeaseActive(lease) || lease.tabId === TAB_ID) {
    writeLeaderLease();
    setLeaderState(true);
    return true;
  }

  setLeaderState(false);
  return false;
}

function heartbeatLeadership() {
  const hasLeadership = claimLeadership();

  if (hasLeadership) {
    writeLeaderLease();
  }
}

function handleStorageChange(event) {
  if (event.key !== LEADER_STORAGE_KEY) return;

  const lease = safeParse(event.newValue);
  if (!isLeaseActive(lease)) {
    claimLeadership();
    return;
  }

  setLeaderState(lease.tabId === TAB_ID);
}

export function hasAnimationLeadership() {
  return leaderState;
}

export function startAnimationLeadership(onChange) {
  leaderChangeHandler = onChange ?? null;

  if (!leaderHeartbeatId) {
    claimLeadership();
    leaderHeartbeatId = window.setInterval(heartbeatLeadership, LEADER_HEARTBEAT_MS);
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("beforeunload", clearLeaderLease);
  }

  return hasAnimationLeadership();
}

export function stopAnimationLeadership() {
  if (leaderHeartbeatId) {
    window.clearInterval(leaderHeartbeatId);
    leaderHeartbeatId = 0;
  }

  window.removeEventListener("storage", handleStorageChange);
  window.removeEventListener("beforeunload", clearLeaderLease);
  clearLeaderLease();
  setLeaderState(false);
  leaderChangeHandler = null;
}
