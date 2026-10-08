# CI/CD Setup Guide

**Date**: February 26, 2026  
**Status**: Ready for Deployment  
**Framework**: GitHub Actions

---

## Quick Start

### Prerequisites

- ✅ GitHub repository set up
- ✅ UrbanGarageSale uploaded to GitHub
- ✅ GitHub Actions enabled in repository settings
- ✅ Node.js 18.x or 20.x

### One-Time Setup (5 minutes)

1. **Enable GitHub Actions**
   ```
   Settings → Actions → General → Allow all actions and reusable workflows
   ```

2. **Add Codecov Integration** (optional)
   ```
   Settings → Secrets and variables → Actions
   New secret: CODECOV_TOKEN = [your codecov.io token]
   ```

3. **Configure Branch Protection Rules** (recommended)
   ```
   Settings → Branches → Add rule
   Branch name: main
   ✅ Require status checks to pass before merging
   ✅ Require branches to be up to date before merging
   Select: "Test Suite" (from Actions)
   ```

4. **Push to GitHub**
   ```bash
   git push origin main
   ```

### Automatic Activation

The workflow is automatically active once:
- ✅ `.github/workflows/test.yml` is in repository
- ✅ File is on `main` or `develop` branch
- ✅ PR or push triggers the workflow

---

## Workflow Overview

### Test Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Push Event                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
       ▼               ▼               ▼
    ┌──────┐       ┌──────┐       ┌──────┐
    │ Test │       │ Lint │    │Security│ (Parallel)
    └──────┘       └──────┘       └──────┘
       │               │               │
       └───────────────┼───────────────┘
                       │
                       ▼
                  ┌──────────┐
                  │  Build   │
                  └──────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  Status Summary  │
              └──────────────────┘
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
         ✅ Pass           ❌ Fail
    (Can merge)      (Blocks merge)
```

### Execution Flow

**Step 1: Checkout & Setup** (1 minute)
- Download code from GitHub
- Install Node.js
- Cache npm dependencies
- Run `npm ci` (clean install)

**Step 2: Tests** (2-3 minutes parallel)
- **test**: Jest tests with coverage
- **lint**: ESLint code quality
- **security**: npm audit + secret scanning
- **build**: Application build check

**Step 3: Reports** (30 seconds)
- Upload coverage to Codecov
- Comment coverage on PR
- Create GitHub status check

**Total Time**: 3-5 minutes

---

## Workflow Configuration

### File Location
```
.github/
└── workflows/
    └── test.yml       ← Main workflow configuration
```

### Workflow Triggers

**On Push to Main/Develop**:
- When code is pushed
- Only if src files or config changed
- Runs for every commit

**On Pull Request**:
- When PR is created or updated
- Blocks merge until passing
- Shows results in PR checks

### Key Settings

| Setting | Value | Reason |
|---------|-------|--------|
| Node versions | 18.x, 20.x | Test across LTS and current |
| Artifact retention | 30 days (tests), 7 days (coverage) | Storage cost optimization |
| Parallel jobs | 4 | Faster feedback |
| Continue on error | Tests (no), others (yes) | Don't block on warnings |

---

## Monitoring the Workflow

### In GitHub UI

1. **View Workflow Run**
   ```
   Actions → Test Suite & Coverage → [Latest Run]
   ```

2. **Check PR Status**
   - PR description shows test status badge
   - Red X = tests failing (can't merge)
   - Green checkmark = tests passing (can merge)

3. **View Coverage Report**
   - After test job completes
   - Check PR comments for coverage numbers
   - Download HTML report from Artifacts tab

### Coverage Report Example

```
## Test Coverage Report

| Metric | Coverage |
|--------|----------|
| Lines | 15.32% |
| Statements | 13.45% |
| Functions | 12.78% |
| Branches | 8.94% |

✅ All tests passing
```

### Debugging Failures

**Test Failed?**
1. Click "Details" in PR status check
2. Scroll to "Run tests" section
3. See which test failed and why
4. Fix locally with `npm test -- --watch`

**Lint Failed?**
1. Run `npm run lint:fix` to auto-fix
2. Or manually fix violations
3. Commit and push again

**Build Failed?**
1. Run `npm run build` locally
2. Fix any TypeScript/syntax errors
3. Commit and push

---

## Performance Optimization

### Cache Strategy

**npm Dependencies** (Key: `web-app/package-lock.json`)
- Cached after first run
- Invalidated when package.json changes
- Saves 30-60 seconds per run

**Artifact Storage**
- Coverage reports: 7 days (can be reduced)
- Test results: 30 days (for historical analysis)
- Build output: 7 days (for debugging)

### Parallel Execution

4 jobs run simultaneously:
- **test** (required, 2-3 mins)
- **lint** (optional, 1 min)
- **security** (optional, 30 secs)
- **build** (optional, 1 min)

Total time: ~3 minutes (parallel) vs ~5 minutes (sequential)

### Hardware
- 2 vCPU, 7 GB RAM per job
- Located in GitHub's data centers
- No additional cost for public repos

---

## Integration with Development Workflow

### Local Development

Still run tests locally before pushing:

```bash
# Terminal 1: Watch mode (automatic test re-run)
npm test -- --watch

# Terminal 2: Development server
npm run dev

# When ready to push...
# Terminal 1: (Ctrl+C) to exit watch mode
npm test                  # Run all tests once
npm run lint              # Check linting
npm run build             # Verify build
```

### Before Creating PR

```bash
cd web-app

# Ensure tests pass
npm test

# Ensure no linting errors
npm run lint:fix

# Ensure build succeeds
npm run build

# Then create PR...
git push origin feature/my-feature
```

### Pull Request Workflow

1. **Create PR** on GitHub
2. **GitHub Actions runs automatically** (takes 3-5 mins)
3. **Review test results** in PR checks
4. **If failing**:
   - Review error messages in Actions tab
   - Fix locally
   - Push again (workflow re-runs automatically)
5. **If passing**:
   - Proceed with code review
   - Once approved AND tests pass, merge

---

## Common Scenarios

### Scenario 1: Tests Pass, Ready to Merge

```
✅ Test Suite (All checks passed)
  ✅ test (Node 18.x)
  ✅ test (Node 20.x)
  ✅ lint
  ✅ security
  ✅ build
  
→ Can merge to main
```

### Scenario 2: Tests Failing, Need to Fix

```
❌ Test Suite (2 tests failed)
  ❌ test (Node 18.x) - Login.test.js line 45
  ⏳ test (Node 20.x) - waiting...
  ✅ lint
  ✅ security
  ✅ build

Action: Fix test locally, push again
```

### Scenario 3: Lint Warning (Non-blocking)

```
⚠️ Test Suite (Tests passed, warnings only)
  ✅ test (Node 18.x)
  ✅ test (Node 20.x)
  ⚠️ lint (2 warnings, 0 errors)
  ✅ security
  ✅ build

Action: Can still merge, but fix linting when possible
```

### Scenario 4: Coverage Regression

```
## Test Coverage Report

| Metric | Coverage | Change |
|--------|----------|--------|
| Lines | 14.2% | ↓ 1.1% |

⚠️ Coverage decreased - add more tests
```

---

## Troubleshooting

### Workflow Not Showing in PR

**Problem**: Actions tab doesn't show workflow results

**Solution 1**: Check file location
```bash
ls -la .github/workflows/test.yml   # Must exist
```

**Solution 2**: Check branch
```bash
git branch -a                       # Must be on main or develop
```

**Solution 3**: Wait for trigger
```
Push to main/develop and refresh PR after 10 seconds
```

**Solution 4**: Check settings
```
Settings → Actions → "Allow all actions" enabled
```

### Tests Pass Locally but Fail in CI

**Cause**: Different Node version or environment

**Solution**:
```bash
# Install specific Node version
nvm install 20
nvm use 20
node --version    # Should show v20.x.x

# Reinstall dependencies
rm -rf node_modules
npm ci

# Run tests again
npm test
```

### Artifacts Not Uploading

**Cause**: Artifacts might not exist or upload failed

**Check**: 
```
Actions → [Run] → Artifacts section
Look for download buttons
```

**If missing**:
```
Tests didn't generate coverage
Fix: Ensure test.js files exist in src/__tests__/
```

### Slow CI Runs

**Cause**: npm install taking too long, or large artifacts

**Optimize**:
```yaml
In .github/workflows/test.yml:

# Reduce artifact retention
retention-days: 3  # Instead of 30

# Use npm ci instead of npm install
npm ci
```

---

## Advanced Configuration

### Custom Notifications

Add to your PR template (`.github/pull_request_template.md`):

```markdown
## Test Status
🚀 This PR automatically runs tests on GitHub Actions

- ✅ Tests must pass before merging
- ⏱️ Pipeline takes ~3-5 minutes
- 📊 Coverage report posted in comments
```

### Slack Notifications (Optional)

Add step to test.yml:
```yaml
- name: Notify Slack
  if: failure()
  run: |
    curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
      -H 'Content-Type: application/json' \
      -d '{"text":"Tests failed on PR #${{ github.event.pull_request.number }}"}'
```

### Scheduled Test Runs (Optional)

Run tests weekly even without pushes:
```yaml
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly Sundays at midnight
```

---

## Maintenance

### Monthly Review

```
Actions → Test Suite & Coverage

Check:
- ✅ All runs successful?
- ✅ Artifact storage within quota?
- ✅ Average run time < 5 mins?
- ✅ Coverage trending upward?
```

### Quarterly Update

```
Review:
- Node version support (LTS changes yearly)
- GitHub Actions version updates
- Coverage thresholds (increase as coverage improves)
- New test requirements
```

---

## Support Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Jest Documentation](https://jestjs.io/)
- [Codecov Setup](https://codecov.io/github)
- [Project TESTING_STRATEGY.md](../TESTING_STRATEGY.md)
- [Code Review Checklist](../CODE_REVIEW_CHECKLIST.md)

---

**Deployed**: February 26, 2026  
**Maintained By**: Development Team  
**Next Review**: March 26, 2026
