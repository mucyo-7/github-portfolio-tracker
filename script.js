/**
 * GitHub Portfolio Readiness Tracker
 * Fetches a public GitHub profile's repos, scores each one on
 * "job-application readiness," and lets the user sort/filter/search
 * the results.
 *
 * Uses the public GitHub REST API (no auth required for basic use,
 * but rate-limited to 60 req/hr per IP without a token).
 * Docs: https://docs.github.com/en/rest
 */

const GITHUB_API = "https://api.github.com";
const GITHUB_TOKEN = ""; // optional local-only token — never commit a real one

const STALE_DAYS = 90;
const BAD_NAME_KEYWORDS = ["test", "untitled", "temp", "hello-world", "sandbox"];

const form = document.getElementById("search-form");
const usernameInput = document.getElementById("username-input");
const searchBtn = document.getElementById("search-btn");
const statusEl = document.getElementById("status-message");
const resultsEl = document.getElementById("results");
const profileCardEl = document.getElementById("profile-card");
const scoreCardEl = document.getElementById("score-card");
const repoListEl = document.getElementById("repo-list");
const sortSelect = document.getElementById("sort-select");
const languageFilter = document.getElementById("language-filter");
const readmeFilter = document.getElementById("readme-filter");
const repoSearch = document.getElementById("repo-search");
const introPanel = document.getElementById("intro-panel");
const exampleChips = document.querySelectorAll(".chip");

let currentRepos = [];

function githubHeaders() {
  const headers = { Accept: "application/vnd.github+json" };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return headers;
}

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
}

/** Animates a number counting up to its target value inside an element. */
function animateNumber(el, target, duration = 700) {
  const start = 0;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const value = Math.round(start + (target - start) * progress);
    el.textContent = `${value}/100`;
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function daysSince(dateString) {
  const then = new Date(dateString);
  const now = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

async function fetchAllRepos(username) {
  let repos = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await fetch(
      `${GITHUB_API}/users/${encodeURIComponent(username)}/repos?per_page=${perPage}&page=${page}&sort=updated`,
      { headers: githubHeaders() }
    );

    if (!res.ok) {
      throw await buildApiError(res);
    }

    const pageData = await res.json();
    repos = repos.concat(pageData);

    if (pageData.length < perPage) break;
    page += 1;
  }

  return repos;
}

async function fetchProfile(username) {
  const res = await fetch(`${GITHUB_API}/users/${encodeURIComponent(username)}`, {
    headers: githubHeaders(),
  });
  if (!res.ok) {
    throw await buildApiError(res);
  }
  return res.json();
}

async function hasReadme(owner, repoName) {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repoName}/readme`, {
      headers: githubHeaders(),
    });
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    return null;
  } catch {
    return null;
  }
}

async function buildApiError(res) {
  if (res.status === 404) {
    return new Error("NOT_FOUND");
  }
  if (res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      const resetHeader = res.headers.get("x-ratelimit-reset");
      const resetTime = resetHeader
        ? new Date(parseInt(resetHeader, 10) * 1000).toLocaleTimeString()
        : "a few minutes";
      return new Error(`RATE_LIMIT:${resetTime}`);
    }
    return new Error("FORBIDDEN");
  }
  return new Error(`API_ERROR:${res.status}`);
}

function scoreRepo(repo, readmeExists) {
  let score = 0;
  const flags = [];

  if (repo.description && repo.description.trim().length > 0) {
    score += 15;
  } else {
    flags.push("No description — add one so visitors know what this does");
  }

  if (readmeExists === true) {
    score += 20;
  } else if (readmeExists === false) {
    flags.push("No README — this is the first thing reviewers look for");
  }

  const staleDays = daysSince(repo.pushed_at);
  if (staleDays <= STALE_DAYS) {
    score += 20;
  } else {
    flags.push(`No activity in ${Math.floor(staleDays / 30)} months — update it or archive it`);
  }

  if (!repo.fork) {
    score += 15;
  } else {
    flags.push("This is a fork — consider highlighting original work instead");
  }

  if (repo.license) {
    score += 10;
  } else {
    flags.push("No license — add one if you want others to reuse this code");
  }

  const nameLower = repo.name.toLowerCase();
  const hasBadName = BAD_NAME_KEYWORDS.some((kw) => nameLower.includes(kw));
  if (!hasBadName) {
    score += 10;
  } else {
    flags.push(`Repo name "${repo.name}" looks like a throwaway — rename it or make it private`);
  }

  if (repo.topics && repo.topics.length > 0) {
    score += 10;
  } else {
    flags.push("No topics/tags — add some to improve discoverability");
  }

  return { score, flags };
}

function scoreTier(score) {
  if (score >= 80) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

function renderProfile(profile) {
  profileCardEl.innerHTML = `
    <img src="${profile.avatar_url}" alt="${profile.login}'s avatar" />
    <div>
      <h2>${profile.name || profile.login}</h2>
      <p>@${profile.login} · ${profile.public_repos} public repos · ${profile.followers} followers</p>
    </div>
  `;
}

function renderScoreCard(repos) {
  const originalRepos = repos.filter((r) => !r.raw.fork);
  const base = originalRepos.length > 0 ? originalRepos : repos;
  const avg = base.length
    ? Math.round(base.reduce((sum, r) => sum + r.score, 0) / base.length)
    : 0;

  const missingReadmeCount = repos.filter((r) => r.readmeExists === false).length;
  const staleCount = repos.filter((r) => daysSince(r.raw.pushed_at) > STALE_DAYS).length;

  scoreCardEl.innerHTML = `
    <div class="score-label">Overall Portfolio Readiness</div>
    <div class="score-number" id="score-number-value">0/100</div>
    <ul>
      ${missingReadmeCount > 0 ? `<li>⚠️ ${missingReadmeCount} repo(s) missing a README</li>` : `<li>✅ All checked repos have a README</li>`}
      ${staleCount > 0 ? `<li>⚠️ ${staleCount} repo(s) inactive for ${STALE_DAYS}+ days</li>` : `<li>✅ All repos have recent activity</li>`}
    </ul>
  `;

  const numberEl = document.getElementById("score-number-value");
  animateNumber(numberEl, avg);
}

function renderRepoList(repos) {
  if (repos.length === 0) {
    repoListEl.innerHTML = `<div class="empty-state">No repos match the current filters.</div>`;
    return;
  }

  repoListEl.innerHTML = repos
    .map((r) => {
      const tier = scoreTier(r.score);
      const updated = new Date(r.raw.pushed_at).toLocaleDateString();
      const isStandout = r.score >= 80;
      return `
        <article class="repo-card${isStandout ? " standout" : ""}">
          <div class="repo-card-top">
            <div>
              <h3><a href="${r.raw.html_url}" target="_blank" rel="noopener">${r.raw.name}</a>${isStandout ? ' <span class="standout-badge">✨ Portfolio-ready</span>' : ""}</h3>
              <p class="repo-desc">${r.raw.description || "No description provided."}</p>
            </div>
            <span class="repo-score-badge badge-${tier}">${r.score}/100</span>
          </div>
          <div class="repo-meta">
            <span>⭐ ${r.raw.stargazers_count}</span>
            <span>${r.raw.language || "Unspecified language"}</span>
            <span>Updated ${updated}</span>
          </div>
          ${
            r.flags.length > 0
              ? `<ul class="repo-flags">${r.flags.map((f) => `<li>${f}</li>`).join("")}</ul>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function populateLanguageFilter(repos) {
  const languages = Array.from(
    new Set(repos.map((r) => r.raw.language).filter(Boolean))
  ).sort();

  languageFilter.innerHTML =
    `<option value="all">All languages</option>` +
    languages.map((lang) => `<option value="${lang}">${lang}</option>`).join("");
}

function applyFiltersAndSort() {
  let repos = [...currentRepos];

  const lang = languageFilter.value;
  if (lang !== "all") {
    repos = repos.filter((r) => r.raw.language === lang);
  }

  const readmeVal = readmeFilter.value;
  if (readmeVal === "missing") {
    repos = repos.filter((r) => r.readmeExists === false);
  } else if (readmeVal === "present") {
    repos = repos.filter((r) => r.readmeExists === true);
  }

  const query = repoSearch.value.trim().toLowerCase();
  if (query) {
    repos = repos.filter((r) => r.raw.name.toLowerCase().includes(query));
  }

  const sortVal = sortSelect.value;
  switch (sortVal) {
    case "score-asc":
      repos.sort((a, b) => a.score - b.score);
      break;
    case "score-desc":
      repos.sort((a, b) => b.score - a.score);
      break;
    case "stars":
      repos.sort((a, b) => b.raw.stargazers_count - a.raw.stargazers_count);
      break;
    case "updated":
      repos.sort((a, b) => new Date(b.raw.pushed_at) - new Date(a.raw.pushed_at));
      break;
    case "name":
      repos.sort((a, b) => a.raw.name.localeCompare(b.raw.name));
      break;
  }

  renderRepoList(repos);
}

[sortSelect, languageFilter, readmeFilter, repoSearch].forEach((el) => {
  el.addEventListener("input", applyFiltersAndSort);
});

exampleChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    usernameInput.value = chip.dataset.username;
    form.requestSubmit();
  });
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  if (!username) return;

  searchBtn.disabled = true;
  resultsEl.classList.add("hidden");
  introPanel.classList.add("hidden");
  setStatus("Loading profile...", "loading");

  try {
    const profile = await fetchProfile(username);
    setStatus("Loading repositories...", "loading");
    const rawRepos = await fetchAllRepos(username);

    if (rawRepos.length === 0) {
      setStatus("This user has no public repositories yet.", "error");
      renderProfile(profile);
      resultsEl.classList.remove("hidden");
      scoreCardEl.innerHTML = "";
      repoListEl.innerHTML = `<div class="empty-state">No public repos to evaluate.</div>`;
      return;
    }

    setStatus(`Checking ${rawRepos.length} repo(s) for READMEs...`, "loading");

    const readmeResults = await Promise.all(
      rawRepos.map((repo) => hasReadme(username, repo.name))
    );

    currentRepos = rawRepos.map((repo, i) => {
      const readmeExists = readmeResults[i];
      const { score, flags } = scoreRepo(repo, readmeExists);
      return { raw: repo, readmeExists, score, flags };
    });

    renderProfile(profile);
    renderScoreCard(currentRepos);
    populateLanguageFilter(currentRepos);
    applyFiltersAndSort();

    resultsEl.classList.remove("hidden");
    setStatus("", "");
  } catch (err) {
    handleError(err);
  } finally {
    searchBtn.disabled = false;
  }
});

function handleError(err) {
  const msg = err.message || "";

  if (msg === "NOT_FOUND") {
    setStatus("No GitHub user found with that username. Check the spelling and try again.", "error");
  } else if (msg.startsWith("RATE_LIMIT:")) {
    const resetTime = msg.split(":")[1];
    setStatus(`GitHub API rate limit reached. Try again after ${resetTime}.`, "error");
  } else if (msg === "FORBIDDEN") {
    setStatus("Access to this data was denied by GitHub. Please try again later.", "error");
  } else if (msg.startsWith("API_ERROR:")) {
    setStatus("GitHub API returned an unexpected error. Please try again in a moment.", "error");
  } else if (err instanceof TypeError) {
    setStatus("Couldn't reach GitHub — check your internet connection and try again.", "error");
  } else {
    setStatus("Something went wrong. Please try again.", "error");
  }
}
