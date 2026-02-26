# Regulatory & Compliance Checklist
**Australian Standards &amp; Privacy Compliance**

**Version:** 1.0  
**Date:** 26 February 2026  
**Status:** In Progress

---

## 1. Australian Privacy Act Compliance

### 1.1 Privacy Principles

| Principle | Requirement | Status | Evidence |
|-----------|-------------|--------|----------|
| **Collection** | Collect only necessary information | ✅ CHECK | User registration only requests essential fields |
| **Use & Disclosure** | Use data only for stated purposes | 🔄 PARTIAL | Privacy policy needed |
| **Data Security** | Protect personal information | ✅ CHECK | Firebase encryption at rest/transit |
| **Access & Correction** | Users can access/correct data | 🔄 PARTIAL | API endpoint needed (Phase 5) |
| **Unique Identifiers** | Don't use gov't IDs unless necessary | ✅ CHECK | Only email + phone used |
| **Anonymity** | Allow anonymous interaction where possible | 🔄 PARTIAL | Browse listings without account (Phase 5) |
| **Transborder Data Flows** | Restrict overseas disclosure | 🔄 PARTIAL | Data residency verification needed |
| **Sensitive Information** | Enhanced protection for health/race/etc | ✅ CHECK | Not collected |
| **Open & Transparent** | Clear privacy policies | ❌ MISSING | Create Privacy Policy (Phase 5) |
| **Individual Redress** | Access complaints mechanism | ❌ MISSING | Privacy Policy + complaint process (Phase 5) |

### 1.2 Phase 5 Actions

- [ ] Draft Privacy Policy document
- [ ] Implement user data access API
- [ ] Add data deletion capabilities
- [ ] Create complaint handling process
- [ ] Verify Firebase data residency (Australia)
- [ ] Review Stripe data handling

**Target Completion:** 31 March 2026

---

## 2. AS/NZS ISO/IEC/IEEE 29119 Testing Standards

### 2.1 Compliance Checklist

| Standard | Requirement | Status | Evidence |
|----------|-------------|--------|----------|
| **29119-1** | Test plan documented | ✅ COMPLETE | TEST_PLAN.md |
| **29119-1** | Requirements mapped | ✅ COMPLETE | TEST_DESIGN_SPECIFICATION.md (RTM) |
| **29119-1** | Test strategy defined | ✅ COMPLETE | TESTING_STRATEGY.md |
| **29119-3** | Test design specification | ✅ COMPLETE | TEST_DESIGN_SPECIFICATION.md |
| **29119-3** | Test cases documented | ✅ COMPLETE | Test files + documentation |
| **29119-4** | Test execution report | ✅ COMPLETE | TEST_EXECUTION_REPORT.md |
| **29119-4** | Defect tracking | ✅ COMPLETE | GitHub Issues |
| **29119-4** | Test metrics recorded | ✅ COMPLETE | 253/254 tests passing (99.61%) |
| **Testing Pyramid** | 70% unit / 20% integration | ✅ ACHIEVED | 69.3% unit / 20.1% integration |
| **Coverage Target** | ≥90% code coverage | ✅ EXCEEDED | 93.1% achieved |

**Overall Compliance:** ✅ 100% (Phase 1-3)

---

## 3. Data Residency Verification

### 3.1 Current Infrastructure

| Component | Location | Verification | Status |
|-----------|----------|--------------|--------|
| **Firebase** | Australia (US default) | ❌ PENDING | Check Firebase console |
| **Stripe** | Multiple regions | ❌ PENDING | Verify in Stripe dashboard |
| **Deno Deploy** | Global CDN | ❌ PENDING | Check Deno project settings |
| **GitHub** | US-based | ✅ KNOWN | US servers (acceptable) |

### 3.2 Phase 5 Actions

```
1. Verify Firebase data location
   - Go to Firebase Console > Project Settings
   - Confirm region = "australia-southeast1"
   - If US: migrate data to Australian region

2. Check Stripe data residency
   - Contact Stripe support for data location
   - Ensure compliance with Australian law

3. Review Deno infrastructure
   - Understand edge function location
   - Ensure data not stored in US
```

---

## 4. Accessibility (WCAG 2.1)

### 4.1 WCAG 2.1 Level AA Compliance

| Criterion | Code | Status | Evidence | Phase |
|-----------|------|--------|----------|-------|
| **Perceivable** | — | 🔄 IN PROGRESS | Testing needed | 5 |
| Alternative text | 1.1.1 | ⚠️ PARTIAL | Images need alt text | 5 |
| Captions & audio | 1.2.1 | ✅ N/A | No video content | — |
| Adaptable content | 1.3.1 | ✅ CHECK | Semantic HTML used | 5 |
| Distinguishable | 1.4.1 | 🔄 PENDING | Color contrast audit | 5 |
| **Operable** | — | 🔄 IN PROGRESS | Keyboard testing needed | 5 |
| Keyboard accessible | 2.1.1 | 🔄 PARTIAL | Need full testing | 5 |
| No keyboard trap | 2.1.2 | ⚠️ PARTIAL | Tab order needs review | 5 |
| Focus visible | 2.4.7 | 🔄 PARTIAL | Focus styles needed | 5 |
| **Understandable** | — | 🔄 IN PROGRESS | User testing needed | 5 |
| Readable language | 3.1.1 | ✅ CHECK | Clear English used | — |
| Predictable behavior | 3.2.1 | ✅ CHECK | Standard navigation | — |
| Error prevention | 3.3.4 | ✅ CHECK | Form validation included | — |
| **Robust** | — | ✅ CHECK | — | — |
| HMTN validity | 4.1.1 | ✅ CHECK | Next.js validates HTML | — |
| ARIA implementation | 4.1.2 | 🔄 PARTIAL | Labels need review | 5 |

### 4.2 Phase 5 Accessibility Audit

**Actions:**
- [ ] Run WAVE accessibility scanner
- [ ] Manual keyboard navigation testing
- [ ] Screen reader testing (NVDA, JAWS)
- [ ] Color contrast verification (WCAG standards)
- [ ] Add missing alt text for images
- [ ] Implement ARIA labels for complex widgets
- [ ] Create accessibility statement

**Target:** WCAG 2.1 Level AA compliance by 31 March 2026

---

## 5. Data Protection & Security

### 5.1 Encryption & Transport

| Layer | Standard | Status | Evidence |
|-------|----------|--------|----------|
| **In Transit** | TLS 1.2+ | ✅ REQUIRED | HTTPS only, no HTTP |
| **At Rest** | AES-256 | ✅ PROVIDED | Firebase encryption |
| **Application** | Passwords hashed | ✅ CHECK | Firebase handles bcrypt |
| **Database** | Firestore security rules | 🔄 PARTIAL | Rules in place, audit needed |

### 5.2 Security Headers

| Header | Purpose | Status | Implem. Phase |
|--------|---------|--------|---------|
| Content-Security-Policy | XSS prevention | ❌ MISSING | Phase 5 |
| Strict-Transport-Security | Force HTTPS | ❌ MISSING | Phase 5 |
| X-Content-Type-Options | MIME sniffing | ❌ MISSING | Phase 5 |
| X-Frame-Options | Clickjacking | ❌ MISSING | Phase 5 |
| Referrer-Policy | Privacy | ❌ MISSING | Phase 5 |

**Implementation Timeline:** Phase 5 (Mar 16-31)

---

## 6. Payment Security (PCI-DSS)

### 6.1 PCI-DSS Compliance Status

| Requirement | Status | Evidence |
|-------------|--------|----------|
| No card data stored | ✅ COMPLIANT | Using Stripe hosted checkout |
| Secure API communication | ✅ COMPLIANT | TLS 1.2+, Firebase tokens |
| Webhook signature verification | ✅ COMPLIANT | verifyStripePayment.ts validates |
| No hardcoded secrets | ✅ COMPLIANT | Using environment variables |
| Transaction logging | ✅ COMPLIANT | Payments logged to Firestore |
| PCI-DSS audit | ❌ PENDING | External audit Phase 7 |

### 6.2 Stripe Merchant Compliance

**Current Status:**
- ✅ Using Stripe JavaScript library (PCI-DSS compliant)
- ✅ No server-side card handling
- ✅ Webhooks validated with signature
- 🔄 Annual merchant survey (due Mar 31)
- ⏳ Formal PCI-DSS audit (Phase 7)

---

## 7. Authentication & Authorization

### 7.1 Security Requirements

| Requirement | Status | Implementation |
|-------------|--------|-----------------|
| Secure password storage | ✅ YES | Firebase Admin SDK bcrypt |
| Password complexity rules | ✅ YES | Min 6 chars, tested |
| Account lockout | 🔄 PARTIAL | Firebase limits login attempts |
| Session expiration | ✅ YES | ID tokens expire in 1 hour |
| Two-factor authentication | 🔄 PARTIAL | SMS verification available |
| Role-based access control | ✅ YES | Admin role enforced |
| Token validation | ✅ YES | All API endpoints verify JWT |

### 7.2 Phase 5 Security Audit

- [ ] Penetration testing on auth endpoints
- [ ] Session fixation testing
- [ ] CSRF token verification
- [ ] Cookie security audit

---

## 8. Incident Response & Breach Notification

### 8.1 Incident Response Plan

**Triggers:**
- Unauthorized data access
- Payment processing failure
- Service outage > 1 hour
- Security vulnerability discovered

**Response Process:**

```
1. DETECTION (immediate)
   - Alert on-call engineer
   - Create incident ticket

2. CONTAINMENT (within 1 hour)
   - Isolate affected systems
   - Prevent data loss
   - Notify affected users if necessary

3. INVESTIGATION (24-48 hours)
   - Root cause analysis
   - Impact assessment
   - Document findings

4. REMEDIATION (varies)
   - Apply fix/patch
   - Test thoroughly
   - Deploy to production

5. NOTIFICATION (if breach)
   - Notify affected users
   - Contact Privacy Commissioner
   - Preserve evidence
```

**Owner:** Tech Lead + DevOps

### 8.2 Breach Notification Policy

**Australian Privacy Act Requirements:**
- Notify affected individuals if likely to result in serious harm
- Notify Privacy Commissioner within 30 days
- Document breach and response

**Document Creation:** Phase 5

---

## 9. Third-Party Compliance

### 9.1 Dependency Audit

| Package | Type | Security Status | Audit Phase |
|---------|------|-----------------|-------------|
| react | Core | ✅ Maintained | Continuous |
| firebase | Auth | ✅ Google-backed | Continuous |
| stripe | Payments | ✅ PCI-compliant | Monthly |
| lucide-react | Icons | ✅ MIT license | Quarterly |
| zod | Validation | ✅ Maintained | Quarterly |

**Actions:**
- [ ] Weekly `npm audit` runs
- [ ] Automated dependency updates
- [ ] License compliance check

---

## 10. Compliance Sign-Off

### 10.1 Current Status

| Area | Status | Owner | Timeline |
|------|--------|-------|----------|
| **Testing Standards** | ✅ COMPLETE | QA Lead | Phase 3 |
| **Privacy Act** | 🔄 IN PROGRESS | Legal | Phase 5 |
| **Data Residency** | ❌ PENDING | DevOps | Phase 5 |
| **Accessibility** | ❌ PENDING | QA | Phase 5 |
| **Security Headers** | ❌ PENDING | Backend | Phase 5 |
| **PCI-DSS** | 🔄 PARTIAL | Finance | Phase 7 |

### 10.2 Formal Sign-Off

```
DOCUMENT SIGN-OFF REQUIRED:

Privacy Officer: _____________________ Date: _____
Compliance Officer: _____________________ Date: _____
Tech Lead: _____________________ Date: _____
Project Manager: _____________________ Date: _____
```

---

## 11. Compliance Dashboard

### 11.1 Completion Status

```
Phase 3 (Complete):
  ✅ Testing Standards (AS/NZS 29119)
  ✅ Test plan & documentation
  ✅ 253 tests passing (99.61%)
  ✅ Code coverage 93.1%

Phase 4 (In Progress):
  🔄 System testing
  🔄 Cross-browser testing
  🔄 Performance testing

Phase 5 (Scheduled):
  ⏳ Privacy Act compliance
  ⏳ Data residency verification
  ⏳ Accessibility (WCAG 2.1)
  ⏳ Security headers
  ⏳ SAST scanning

Phase 6 (Scheduled):
  ⏳ Penetration testing
  ⏳ Load testing

Phase 7 (Scheduled):
  ⏳ Production deployment
  ⏳ PCI-DSS audit
```

---

## 12. References

- Australian Privacy Act 1988: https://www.legislation.gov.au/C2014C00076
- AS/NZS ISO/IEC/IEEE 29119: Software Testing Standards
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- PCI-DSS 4.0: Payment Card Industry Standards
- Stripe Documentation: https://stripe.com/docs

---

**Document Control:**
- Version: 1.0 | Date: 26 Feb 2026 | Status: Active
- Last Updated: 26 February 2026
- Next Review: 31 March 2026 (post-Phase 5)
- Compliance Owner: Tech Lead + Legal
