# Release Management & Deployment Guide
**Phase 7 - Production Deployment**

**Version:** 1.0  
**Date:** 26 February 2026  
**Status:** Pre-Deployment Planning

---

## 1. Release Versioning

### 1.1 Version Number Format

```
MAJOR.MINOR.PATCH-PRERELEASE+BUILD

Example: 1.0.0-rc.1+build-001

MAJOR: Breaking changes (1.0, 2.0)
MINOR: New features (1.1, 1.2, 1.3)
PATCH: Bug fixes (1.0.1, 1.0.2)
PRERELEASE: alpha, beta, rc (1.0.0-rc.1)
BUILD: Build metadata (build-001)
```

### 1.2 Release Timeline

| Version | Phase | Timeline | Status |
|---------|-------|----------|--------|
| **0.3.0** | Phase 3 (Test Suite) | ✅ Complete | Testing complete |
| **0.4.0** | Phase 4 (System) | Mar 1-15, 2026 | Planning |
| **0.5.0** | Phase 5 (Security) | Mar 16-31, 2026 | Planning |
| **1.0.0-rc.1** | Phase 6 (Perf) | Apr 1-15, 2026 | Planning |
| **1.0.0** | Phase 7 (Prod) | Apr 16-30, 2026 | Planning |

---

## 2. Pre-Release Checklist

### 2.1 Code Quality Verification

- [ ] All tests passing (100% - Phase 3 baseline)
- [ ] Code coverage ≥ 90% (current: 93.1%)
- [ ] Linting passes (npm run lint:fix)
- [ ] No critical vulnerabilities (npm audit)
- [ ] Code review approved (minimum 2 reviewers)
- [ ] Documentation updated
- [ ] Changelog updated

**Command:**
```bash
cd web-app

# Verify quality
npm test                    # All tests pass
npm audit                   # No critical vulns
npm run lint                # No lint errors
npm run build               # Build succeeds

# 4/4 checks must pass ✅
```

### 2.2 Feature Completeness

- [ ] Phase 4 system testing complete
- [ ] Phase 5 security audit complete
- [ ] Phase 6 performance testing complete
- [ ] Accessibility testing complete (WCAG 2.1 AA)
- [ ] All critical bugs fixed
- [ ] Known issues documented

### 2.3 Documentation Verification

- [ ] TEST_PLAN.md - Complete and reviewed
- [ ] TEST_DESIGN_SPECIFICATION.md - Complete
- [ ] TEST_EXECUTION_REPORT.md - Complete
- [ ] TESTING_STRATEGY.md - Complete
- [ ] CODE_REVIEW_CHECKLIST.md - Complete
- [ ] CI_CD_SETUP.md - Complete
- [ ] RELEASE_NOTES.md - Complete
- [ ] Deployment guide - This document

### 2.4 Infrastructure Verification

- [ ] Firestore configured and tested
- [ ] Firebase credentials validated
- [ ] Stripe production keys configured
- [ ] Environment variables documented
- [ ] Backup procedures documented
- [ ] Monitoring/alerting configured

---

## 3. Release Notes Template

**File:** RELEASE_NOTES.md

```markdown
# UrbanGarageSale Release Notes

**Version:** 1.0.0  
**Release Date:** 30 April 2026  
**Status:** PRODUCTION

## Summary

UrbanGarageSale v1.0.0 is the first production release, featuring:
- Complete garage sale marketplace functionality
- Stripe payment integration
- Admin dashboard
- Search and filtering
- Favorite listings
- Email notifications

## New Features

### Major Features
- ✨ User registration and authentication
- ✨ Create and manage garage sale listings
- ✨ Browse and search listings by suburb/distance
- ✨ Premium listing upgrade with Stripe payment
- ✨ Save favorite listings
- ✨ Admin dashboard with moderation features
- ✨ Email notifications
- ✨ Image upload and optimization

### Minor Features
- 🔧 Listing editing and deletion
- 🔧 User profile management
- 🔧 Listing expiration
- 🔧 Contact seller functionality

## Bug Fixes

- Fixed: Distance calculation for listings
- Fixed: Image optimization on mobile
- Fixed: Payment webhook verification
- Fixed: Admin access control
- Fixed: Email delivery reliability

## Known Issues

| Issue | Workaround | Priority |
|-------|-----------|----------|
| SMS verification can be slow (up to 2 min) | Resend code available | Low |
| Map may not load on slow connections | Retry or reload page | Low |
| Large image uploads (>10MB) may fail | Compress image first | Medium |

## Deprecations

None - first release.

## Security Updates

- ✅ All dependencies audited
- ✅ No critical vulnerabilities
- ✅ Encryption in transit (TLS 1.2+)
- ✅ Passwords hashed with bcrypt
- ✅ CSRF protection enabled
- ✅ XSS prevention via React auto-escaping

## Performance

- Page load time: ~2 seconds (target: < 3 sec)
- API response: ~400ms average (target: < 500ms)
- Database queries: ~100ms average
- Image optimization: Reduced sizes by 60%

## Analytics

- Tests: 254 total (253 passing, 1 skipped) = 99.61% pass rate
- Code coverage: 93.1%
- Accessibility: WCAG 2.1 Level AA compliant
- Browser compatibility: Chrome, Firefox, Safari, Edge (latest)
- Mobile compatibility: iOS 12+, Android 6+

## System Requirements

- Node.js: 18.x or 20.x LTS
- npm: 9.x or higher
- Browser: Modern browser with ES2020 support
- Database: Firestore (Cloud)
- Payment: Stripe account required

## Installation

### Web App
```bash
cd web-app
npm install
npm run build
npm run preview  # Test build
```

### Mobile App (Flutter)
```bash
flutter pub get
flutter run --release
```

## Upgrade Guide

N/A - First release. Fresh installation required.

## Contributors

- Development team
- QA team
- Security reviewers
- Accessibility experts

## Support

For issues or questions:
- GitHub Issues: [Link]
- Email: support@urbangaragese.com.au
- Documentation: [Link to docs]

## Changelog

See CHANGELOG.md for detailed commit history.

---

**Released:** 30 April 2026  
**Maintained by:** UrbanGarageSale Team  
**License:** [As specified in LICENSE.md]
```

---

## 4. Deployment Procedure

### 4.1 Pre-Deployment (1 week before)

```bash
# Step 1: Create release branch
git checkout -b release/v1.0.0

# Step 2: Update version numbers
# - web-app/package.json: version = "1.0.0"
# - lib/pubspec.yaml: version = "1.0.0"
# - README.md: Update version references

# Step 3: Update changelog
# Create CHANGELOG.md with all changes since v0.3.0

# Step 4: Final testing
npm test                         # All tests pass
npm run lint                     # No linting errors
npm audit                        # No vulnerabilities
npm run build                    # Production build succeeds

# Step 5: Commit and push
git add -A
git commit -m "release: v1.0.0 release candidate"
git push origin release/v1.0.0
```

### 4.2 Staging Deployment (3 days before production)

```bash
# Step 1: Deploy to staging environment
npm run build
npm run deploy:staging

# Step 2: Run smoke tests
npm run test:smoke              # Core functionality
npm run test:integration        # API integration

# Step 3: Verify features
- Create test account
- Create test listing
- Process test payment
- Check admin dashboard
- Verify email notifications

# Step 4: Performance monitoring
- Monitor API response times
- Check database performance
- Verify image optimization

# Step 5: Security scan (staging)
npm audit
npm run security:scan
```

### 4.3 Production Deployment

#### Approval Gates

```
Deployment Approval Checklist:

☐ Tech Lead:      Reviewed code & tests
☐ QA Lead:        Verified staging deployment
☐ Security Lead:  Approved security scan
☐ DevOps Lead:    Validated infrastructure
☐ Product Owner:  Approved feature set
☐ Finance/Legal:  Confirmed compliance

All gates must be checked before proceeding.
```

#### Deployment Steps

**Option 1: Standard Deployment**
```bash
# Step 1: Create production build tag
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0

# Step 2: Deploy to production
npm run build
npm run deploy:production

# Step 3: Verify deployment
npm run test:smoke:production
npm run verify:endpoints

# Step 4: Monitor
- Watch application logs
- Monitor API response times
- Track error rates
- Check user registrations
```

**Option 2: Blue-Green Deployment (Recommended)**

```
Blue Environment:  Current production v0.3.0
Green Environment: New version v1.0.0

Procedure:
1. Deploy v1.0.0 to Green (offline)
2. Run smoke tests on Green
3. If pass: Route traffic to Green
4. Keep Blue online for 24 hours (rollback ready)
5. After 24 hours stability: Decommission Blue
```

### 4.4 Post-Deployment

```
Step 1: Monitoring (first 24 hours)
  ✅ Error rate < 0.1%
  ✅ API response < 1 second
  ✅ No critical exceptions
  ✅ User registrations working

Step 2: Verification (24-48 hours)
  ✅ Email notifications sending
  ✅ Payments processing
  ✅ Search results accurate
  ✅ Admin dashboard functional

Step 3: Communication (Day 1)
  ✅ Send release announcement
  ✅ Notify users of new features
  ✅ Provide support contact
  ✅ Publish release notes

Step 4: Documentation (Day 3)
  ✅ Update deployment logs
  ✅ Document any issues encountered
  ✅ Update runbooks
  ✅ Archive build artifacts
```

---

## 5. Rollback Procedures

### 5.1 Rollback Decision Tree

```
ISSUE DETECTED?
  │
  ├─ Is it BLOCKING (payments down, login broken)?
  │   └─ YES → IMMEDIATE ROLLBACK (within 5 min)
  │
  ├─ Is it CRITICAL (data corruption, security)?
  │   └─ YES → ROLLBACK (within 15 min)
  │
  ├─ Is it HIGH (major feature broken)?
  │   └─ YES → ROLLBACK (within 1 hour)
  │
  └─ Is it MEDIUM or LOW?
      └─ PATCH (fix and redeploy, no rollback)
```

### 5.2 Rollback Procedure

```bash
# Step 1: Declare rollback decision
# - Alert team immediately
# - Create incident ticket
# - Notify stakeholders

# Step 2: Stop current deployment
# - Stop accepting new traffic
# - Switch to previous version

# Option A: Blue-Green Switch (fastest)
# - Route traffic back to Blue environment
# - Time: < 30 seconds

# Option B: Git Rollback (if Blue unavailable)
git checkout v0.3.0                    # Previous stable version
npm run build
npm run deploy:production

# Step 3: Verify rollback
npm run test:smoke                     # Test core functionality
npm run verify:endpoints               # Verify APIs working

# Step 4: Confirm stability
# - Monitor for 5 minutes
# - Verify error rate normal
# - Check user access

# Step 5: Communicate
# - Notify users of situation
# - Provide ETA for fix
# - Post status updates
```

### 5.3 Rollback Testing

**Test before production:**
```bash
# Simulate rollback in staging
npm run deploy:staging:v1.0.0       # Deploy v1.0.0
sleep 60                            # Run for 1 minute
npm run deploy:staging:v0.3.0       # Rollback to v0.3.0
npm run test:smoke:staging          # Verify rollback works

# Expected: All tests pass, application stable ✅
```

---

## 6. Release Communication

### 6.1 Announcement Email Template

```
Subject: 🎉 UrbanGarageSale v1.0.0 is Live!

Dear UrbanGarageSale Users,

We're thrilled to announce the release of UrbanGarageSale v1.0.0!

WHAT'S NEW:
✨ User authentication and profiles
✨ Create and manage garage sales
✨ Browse and search listings
✨ Secure Stripe payments
✨ Admin moderation tools

FEATURES:
🔍 Search by suburb and distance
❤️ Save favorite listings
📧 Email notifications
🖼️ Image optimization
📱 Mobile-friendly design

GET STARTED:
Visit: https://www.urbangarageSale.com.au
Create account → Post listing → Start selling!

SUPPORT:
Questions? Email: support@urbangarageSale.com.au

Thank you for choosing UrbanGarageSale!

---
UrbanGarageSale Team
```

### 6.2 Release Party / Demo

**Schedule:** Release day (4-5 PM)

**Attendees:** Team, stakeholders, early beta users

**Demo Flow:**
1. Account creation (2 min)
2. Create listing with images (3 min)
3. Search and filter listings (2 min)
4. Payment processing (2 min)
5. Admin dashboard (2 min)
6. Q&A (5 min)

---

## 7. Post-Release Activities

### 7.1 Monitoring Plan (Week 1)

```
Daily Checks:
  ✅ Error rate monitoring
  ✅ API performance
  ✅ Database performance
  ✅ Payment success rate
  ✅ User registrations

Weekly Report (Friday):
  - Total new users
  - Listings created
  - Payments processed
  - Errors encountered
  - Performance metrics
```

### 7.2 Hotfix Process

If critical issue found post-release:

```bash
# Create hotfix branch
git checkout -b hotfix/v1.0.1

# Fix the issue
# Test thoroughly
npm test                            # All tests pass

# Create and deploy patch
git tag -a v1.0.1 -m "Hotfix: [issue description]"
npm run deploy:production

# Document changes
# Update changelog
# Announce hotfix
```

### 7.3 Release Retrospective (Week 2)

**Attendees:** Tech lead, QA, DevOps, Product

**Questions:**
1. What went well? What didn't?
2. Any unexpected issues?
3. Were processes followed?
4. How can we improve next release?
5. Lessons learned?

**Output:** Improvement items for next release

---

## 8. Version Maintenance Policy

### 8.1 Support Timeline

| Version | Release | Support Until | Status |
|---------|---------|---------------|--------|
| 0.3.0 | Jan 26 | Mar 26 | Beta EOL |
| 0.4.0 | Mar 15 | May 15 | Maintenance |
| 0.5.0 | Mar 31 | May 31 | Maintenance |
| 1.0.0 | Apr 30 | Apr 30, 2027 | LTS |

### 8.2 Update Frequency

- **Security updates:** Within 24 hours of discovery
- **Critical bugs:** Within 1 week
- **Features:** Every 2-4 weeks
- **LTS versions:** Quarterly updates for 2 years

---

## 9. Deployment Infrastructure Checklist

### 9.1 Staging Environment

- [ ] Staging server running (identical to production)
- [ ] Staging database synchronized with production data
- [ ] SSL certificates valid
- [ ] Monitoring configured
- [ ] Backup procedures tested

### 9.2 Production Environment

- [ ] Production servers with auto-scaling
- [ ] Load balancer configured
- [ ] SSL/TLS certificates updated
- [ ] CDN configured for assets
- [ ] DDoS protection enabled
- [ ] WAF (Web Application Firewall) configured
- [ ] Backup automated (daily)
- [ ] Disaster recovery tested
- [ ] Monitoring and alerting active
- [ ] Log aggregation configured

---

## 10. Sign-Off & Approval

### 10.1 Release Approval Board

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Tech Lead** | — | — | — |
| **QA Lead** | — | — | — |
| **DevOps Lead** | — | — | — |
| **Product Owner** | — | — | — |
| **Compliance/Legal** | — | — | — |

### 10.2 Deployment Authorization

```
Production deployment authorized by:

________________________        ____________
Tech Lead Signature            Date

Deployment Status:
☐ Not Started
☐ In Progress
☐ Complete - Success
☐ Complete - Required Rollback
```

---

## 11. References

- GitHub Release Management: https://docs.github.com/en/repositories/releasing-projects-on-github/
- Semantic Versioning: https://semver.org
- Blue-Green Deployment: https://martinfowler.com/bliki/BlueGreenDeployment.html
- Deployment Checklist: https://www.deployment101.com/

---

**Document Control:**
- Version: 1.0 | Date: 26 Feb 2026 | Status: Planning
- Timeline: Phase 7 (Apr 16-30, 2026)
- Approval Required: Yes (5 sign-offs)
- Last Updated: 26 February 2026
- Next Review: 1 week before production release
