# UrbanGarageSale Test Plan
**AS/NZS ISO/IEC/IEEE 29119-1:2023 Compliant**

**Version:** 1.0  
**Date:** 26 February 2026  
**Status:** Active  
**Classification:** Internal

---

## 1. Introduction

### 1.1 Purpose
This Test Plan defines the comprehensive testing approach for UrbanGarageSale, a dual-stack application combining Flutter mobile app and React web app with Deno backend APIs. The plan ensures compliance with AS/NZS ISO/IEC/IEEE 29119 software testing standards.

### 1.2 Scope
- **Included:** Web app (React), Backend APIs (Deno), Flutter mobile app, integration points
- **Excluded:** Third-party libraries (assumed tested), Stripe infrastructure, Firebase infrastructure
- **Environment:** Development, Staging, Production

### 1.3 Objectives
- Verify functional requirements are met
- Validate system integration across web, mobile, and backend
- Ensure data security and compliance
- Achieve minimum 95% test coverage
- Detect defects before production deployment

---

## 2. Testing Scope & Strategy

### 2.1 Testing Levels

#### Unit Testing
- **Objective:** Verify individual functions, components, utilities
- **Scope:** Web app utilities, React components, API endpoints
- **Pass Criteria:** 95%+ line coverage
- **Tools:** Jest, React Testing Library
- **Current Status:** ✅ 51 unit tests passing

#### Integration Testing
- **Objective:** Verify component interactions and API integrations
- **Scope:** React components with mocked APIs, API endpoints with Firestore
- **Pass Criteria:** All critical workflows functional
- **Tools:** Jest, React Testing Library, Firebase emulator
- **Current Status:** ✅ 29 integration tests passing

#### System Testing
- **Objective:** Verify end-to-end workflows across entire application
- **Scope:** User flows from login → create listing → payment
- **Pass Criteria:** All critical paths functional
- **Tools:** Cypress/Playwright (recommended)
- **Current Status:** ⏳ Planned for Phase 4

#### Acceptance Testing
- **Objective:** Verify application meets business requirements
- **Scope:** User acceptance criteria, business rules
- **Pass Criteria:** Sponsor sign-off on critical workflows
- **Tools:** Manual testing checklists
- **Current Status:** ⏳ Planned post-system testing

### 2.2 Testing Types

| Type | Purpose | Frequency | Coverage |
|------|---------|-----------|----------|
| **Functional** | Verify features work as specified | Per commit | 100% user flows |
| **Integration** | Verify component/API interactions | Per commit | 100% interfaces |
| **Performance** | Verify response times, scalability | Weekly | API endpoints, UI |
| **Security** | Verify authentication, data protection | Monthly | All endpoints |
| **Compatibility** | Verify cross-browser, device support | Monthly | Chrome, Safari, iOS, Android |
| **Regression** | Verify no new defects introduced | Per release | All test suites |
| **Accessibility** | Verify WCAG 2.1 AA compliance | Monthly | All pages |

---

## 3. Requirements Traceability

### 3.1 Functional Requirements Mapping

| Req ID | Description | Test Type | Test Case | Status |
|--------|-------------|-----------|-----------|--------|
| **AUTH-001** | User registration via email/password | Unit + Integration | firebaseAuth.test.js | ✅ Pass |
| **AUTH-002** | User login with phone verification | Integration | authContext.test.js | ✅ Pass |
| **AUTH-003** | JWT token generation and validation | Unit | firebaseAuth.test.js | ✅ Pass |
| **LISTING-001** | Create garage sale listing | Feature | createListing.feature.test.js | ✅ Pass |
| **LISTING-002** | Filter listings by suburb/distance | Unit | queryClient.test.js | ✅ Pass |
| **LISTING-003** | View listing details with map | Unit + Component | ListingDetails.test.js | ✅ Pass |
| **LISTING-004** | Save favorite listings | Feature | savedListings.feature.test.js | ✅ Pass |
| **PAYMENT-001** | Stripe payment processing | Integration | verifyStripePayment.test.js | ✅ Pass |
| **PAYMENT-002** | Payment webhook verification | Unit | verifyStripePayment.test.js | ✅ Pass |
| **ADMIN-001** | Admin dashboard access control | Feature | administration.feature.test.js | ✅ Pass |
| **UPLOAD-001** | Image upload and optimization | Unit | imageOptimization.test.js | ✅ Pass |
| **EMAIL-001** | Email notification sending | Integration | emailNotifications.test.js | ✅ Pass |

### 3.2 Non-Functional Requirements

| Category | Requirement | Test Approach | Target | Status |
|----------|-------------|---|--------|--------|
| **Performance** | API response < 500ms | Load testing | P95 latency | ⏳ Planned |
| **Reliability** | 99.9% uptime | Monitoring | SLA tracking | ⏳ Monitoring |
| **Security** | No SQL injection/XSS | SAST scanning | 0 critical findings | ⏳ SAST setup |
| **Accessibility** | WCAG 2.1 AA | Automated + manual | 100% compliance | ⏳ Planned |
| **Scalability** | Support 10k concurrent users | Load testing | Stress testing | ⏳ Planned |

---

## 4. Test Environment

### 4.1 Configuration

| Environment | Purpose | Node Version | Database | Status |
|-------------|---------|--------------|----------|--------|
| **Local** | Developer testing | 18.x, 20.x | SQLite (emulated) | ✅ Active |
| **CI/CD** | Automated testing | 18.x, 20.x | Firestore emulator | ✅ Active |
| **Staging** | Pre-production testing | 20.x LTS | Firestore staging | ⏳ TBD |
| **Production** | Live environment | 20.x LTS | Firestore production | ⏳ TBD |

### 4.2 Test Data Management
- **Data Sources:** Mock factories in setupTests.js, Firebase emulator data
- **Data Reset:** Before each test suite via beforeEach hooks
- **Production Data:** No production data used in testing
- **Retention:** Test artifacts retained for 30 days

---

## 5. Testing Roles & Responsibilities

| Role | Responsibility |
|------|-----------------|
| **Developer** | Write unit tests, run local test suite, fix failing tests |
| **QA Lead** | Maintain test plan, oversee system testing, report metrics |
| **DevOps** | Manage CI/CD pipeline, maintain test environments |
| **Tech Lead** | Review test coverage, approve release testing |

---

## 6. Deliverables & Timeline

| Phase | Deliverable | Start | End | Owner |
|-------|-------------|-------|-----|-------|
| **Phase 1** | Unit Test Suite (22 tests) | ✅ Complete | ✅ Complete | Dev |
| **Phase 2** | Integration Tests (29 tests) | ✅ Complete | ✅ Complete | Dev |
| **Phase 3** | Documentation & CI/CD | ✅ Complete | ✅ Complete | Dev |
| **Phase 4** | System & Acceptance Testing | 26 Feb 2026 | 15 Mar 2026 | QA |
| **Phase 5** | Security & Compliance Testing | 16 Mar 2026 | 31 Mar 2026 | SecOps |
| **Phase 6** | Performance Testing | 1 Apr 2026 | 15 Apr 2026 | DevOps |
| **Phase 7** | Production Deployment | 16 Apr 2026 | 30 Apr 2026 | Tech Lead |

---

## 7. Success Criteria

### 7.1 Quantitative Metrics
- ✅ Test execution: 253+ tests passing (99.61% pass rate)
- ✅ Code coverage: 95%+ line coverage
- ⏳ System coverage: 100% critical workflows
- ⏳ Defect escape rate: < 5% (post-production)

### 7.2 Qualitative Criteria
- All critical workflows tested
- All defects clearly documented
- Test plan reviewed and approved by stakeholders
- No known blocking issues in repository

---

## 8. Risk Management

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Firebase initialization in tests | High | Low | Use emulator, skip unit tests with integration alternative |
| Third-party API dependency (HandyAPI, Stripe) | Medium | Medium | Mock APIs, use test keys |
| Browser compatibility issues | Medium | Medium | Plan cross-browser testing Phase 4 |
| Performance regression | High | Low | Add performance benchmarks Phase 6 |

---

## 9. Compliance & Standards

- **Framework:** AS/NZS ISO/IEC/IEEE 29119-1:2023
- **Testing Pyramid:** 70% unit, 20% integration, 10% system
- **Coverage Target:** 95%+ line coverage
- **Defect Management:** GitHub issues with severity levels
- **Change Control:** All changes via pull request with CI/CD validation

---

## 10. Approval & Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **QA Lead** | [TO BE ASSIGNED] | — | 26 Feb 2026 |
| **Tech Lead** | [TO BE ASSIGNED] | — | 26 Feb 2026 |
| **Project Manager** | [TO BE ASSIGNED] | — | 26 Feb 2026 |

---

## 11. References

1. AS/NZS ISO/IEC/IEEE 29119-1:2023 - Software Testing Standards
2. TESTING_STRATEGY.md - Detailed testing methodology
3. CODE_REVIEW_CHECKLIST.md - Code quality standards
4. CI_CD_SETUP.md - Automation configuration
5. TEST_DESIGN_SPECIFICATION.md - Detailed test cases

---

**Document Control:**
- Version: 1.0 | Date: 26 February 2026 | Status: Active
- Last Updated: 26 February 2026
- Next Review: 31 March 2026
