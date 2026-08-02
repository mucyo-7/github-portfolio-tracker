# GitHub Portfolio Readiness Tracker

A small web app that checks how "job-application ready" a GitHub profile
looks, and gives specific, actionable feedback on what to fix — not just a
list of repos.

## Why this exists

Recruiters skim GitHub profiles in seconds. Most students' profiles have
undocumented repos, no READMEs, or stale projects that hurt the impression
they give. This tool fetches a public GitHub profile's repos and scores
each one on concrete signals recruiters actually notice (README present,
description present, recent activity, license, sensible naming, topics),
then surfaces specific fixes — turning raw API data into a self-audit tool
rather than just a repo viewer.

## Features

- Look up any public GitHub username
- Full pagination support (handles users with 100+ repos)
- Per-repo readiness score (0–100) with human-readable flags
- Overall portfolio readiness score
- Sort by score, stars, recently updated, or name
- Filter by language and README status
- Live search within a user's repos
- Graceful error handling: invalid username (404), API rate limiting (403),
  network failure, and empty-profile states
- Example username chips and an intro panel explaining the tool's purpose

## APIs Used

- [GitHub REST API](https://docs.github.com/en/rest) — `GET /users/{username}`,
  `GET /users/{username}/repos`, `GET /repos/{owner}/{repo}/readme`.
  All credit to GitHub / the GitHub REST API documentation team.

No API key is required for basic use (60 requests/hour per IP, unauthenticated).

## Running Locally

1. Clone this repository:
```bash
   git clone https://github.com/mucyo-7/github-portfolio-tracker.git
   cd github-portfolio-tracker
```
2. Serve the folder with any static server:
```bash
   python3 -m http.server 8000
```
3. Visit `http://localhost:8000`

No build step, no dependencies — plain HTML/CSS/JS.

## Deployment (Web01 / Web02 + Load Balancer)

The app is a static site (HTML/CSS/JS only), so deployment is a simple
file copy + web server config on each host.

1. Cloned the repository directly onto both `Web01` (`18.212.54.68`) and
   `Web02` (`3.83.2.51`) under `/var/www/github-portfolio-tracker`
2. Installed and configured Nginx on each server to serve the static
   files from that directory on port 80
3. Configured `Lb01` (`3.82.196.160`) to balance traffic between
   Web01 and Web02 using round-robin
4. Verified load balancing by refreshing the load balancer's address
   repeatedly and confirming responses were served by both backend
   servers

Exact commands used are in the "Deployment Steps" section below.

### Deployment Steps

```bash
# On Web01 and Web02 (repeat on both):
sudo apt update && sudo apt install -y nginx git
cd /var/www
sudo git clone https://github.com/mucyo-7/github-portfolio-tracker.git
sudo rm -rf /var/www/html
sudo ln -s /var/www/github-portfolio-tracker /var/www/html
sudo systemctl restart nginx
```

```bash
# On Lb01 — HAProxy config (/etc/haproxy/haproxy.cfg):
frontend http_front
   bind *:80
   default_backend web_servers

backend web_servers
   balance roundrobin
   server web01 18.212.54.68:80 check
   server web02 3.83.2.51:80 check
```
```bash
sudo systemctl restart haproxy
```

## Challenges & How They Were Solved

- Handling GitHub API pagination for users with many repositories —
  solved by looping through pages until a page returns fewer than the
  max per-page count.
- Avoiding a blank/broken UI on invalid usernames or rate limiting —
  solved with explicit error branches for 404, 403, and network failures,
  each with a distinct user-facing message.

## Credits

- [GitHub REST API](https://docs.github.com/en/rest)
- Built by Mucyo for the "Playing Around with APIs" assignment

## Demo Video

[Watch the demo video](https://drive.google.com/file/d/1X27NxauCl_piVvbkPHDCCPGMtCX507FN/view?usp=drive_link)

## Live Deployment

https://www.mucyo7devopsproject.online
