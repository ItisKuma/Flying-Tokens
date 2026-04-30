export const NS = "token-status";
export const LEGACY_NS = "simple-flying";
export const FLYING_STATUS_ID = "flying";
export const DEAD_STATUS_ID = "dead";

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeLegacyRoot(root) {
  if (!root) {
    return null;
  }

  if (root.statuses && typeof root.statuses === "object") {
    return root;
  }

  return {
    statuses: {
      [FLYING_STATUS_ID]: {
        ...cloneJson(root),
        active: Boolean(root.flying),
      },
    },
  };
}

export function getStatusRootFromMetadata(metadata) {
  const currentRoot = metadata?.[NS];

  if (currentRoot) {
    return normalizeLegacyRoot(currentRoot);
  }

  const legacyRoot = metadata?.[LEGACY_NS];
  return normalizeLegacyRoot(legacyRoot);
}

export function getStatusRoot(item) {
  return getStatusRootFromMetadata(item?.metadata);
}

export function getStatusData(item, statusId) {
  return getStatusRoot(item)?.statuses?.[statusId] ?? null;
}

export function hasLegacyStatusMetadata(item) {
  return Boolean(item?.metadata?.[LEGACY_NS] && !item?.metadata?.[NS]);
}

export function setItemStatusData(item, statusId, statusData) {
  const root = getStatusRoot(item) ?? { statuses: {} };

  item.metadata = {
    ...item.metadata,
    [NS]: {
      ...root,
      statuses: {
        ...root.statuses,
        [statusId]: cloneJson(statusData),
      },
    },
  };

  if (item.metadata?.[LEGACY_NS]) {
    delete item.metadata[LEGACY_NS];
  }
}

export function removeItemStatusData(item, statusId) {
  const root = getStatusRoot(item);

  if (!root) {
    if (item?.metadata?.[LEGACY_NS]) {
      delete item.metadata[LEGACY_NS];
    }
    return;
  }

  const nextStatuses = {
    ...root.statuses,
  };
  delete nextStatuses[statusId];

  item.metadata = {
    ...item.metadata,
  };

  if (Object.keys(nextStatuses).length === 0) {
    delete item.metadata[NS];
  } else {
    item.metadata[NS] = {
      ...root,
      statuses: nextStatuses,
    };
  }

  if (item.metadata?.[LEGACY_NS]) {
    delete item.metadata[LEGACY_NS];
  }
}

export function migrateItemStatusMetadata(item) {
  const root = getStatusRoot(item);

  if (!root) {
    return false;
  }

  const hadLegacy = hasLegacyStatusMetadata(item);

  item.metadata = {
    ...item.metadata,
    [NS]: cloneJson(root),
  };

  if (item.metadata?.[LEGACY_NS]) {
    delete item.metadata[LEGACY_NS];
  }

  return hadLegacy;
}
