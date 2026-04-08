'use strict';

const fs = require('fs').promises;
const path = require('path');

const HEALTH_FILE = path.join(__dirname, '../../logs/health-cron.json');
const HEALTH_FILE_TMP = `${HEALTH_FILE}.tmp`;

let state = {
  status: 'unknown',
  updatedAt: null,
  jobs: {},
  meta: {
    timezone: process.env.TZ || 'server-local',
    pid: process.pid,
  },
};

function deriveGlobalStatus(jobs) {
  const items = Object.values(jobs || {});
  if (items.some((j) => j.status === 'error')) return 'error';
  if (items.some((j) => j.status === 'warn')) return 'warn';
  if (items.length === 0) return 'unknown';
  return 'ok';
}

async function persistSnapshot() {
  const payload = JSON.stringify(state, null, 2);
  await fs.writeFile(HEALTH_FILE_TMP, payload, 'utf8');
  await fs.rename(HEALTH_FILE_TMP, HEALTH_FILE);
}

async function updateCronHealth(jobName, patch) {
  state = {
    ...state,
    jobs: {
      ...state.jobs,
      [jobName]: {
        ...(state.jobs[jobName] || {}),
        ...patch,
      },
    },
  };
  state.updatedAt = new Date().toISOString();
  state.status = deriveGlobalStatus(state.jobs);
  await persistSnapshot();
  return state;
}

function getCronHealth() {
  return {
    ...state,
    status: deriveGlobalStatus(state.jobs),
    updatedAt: state.updatedAt,
  };
}

module.exports = {
  updateCronHealth,
  getCronHealth,
  HEALTH_FILE,
};
