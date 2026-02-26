# System Testing & End-to-End Testing Guide
**Phase 4 - Implementation Plan**

**Version:** 1.0  
**Date:** 26 February 2026  
**Timeline:** March 1 - March 15, 2026

---

## 1. Executive Summary

Phase 4 will implement system-level testing covering complete user workflows from login through payment completion. This guide establishes test scenarios, tools, and success criteria for end-to-end validation before production deployment.

---

## 2. System Testing Strategy

### 2.1 Testing Levels

#### User Acceptance Testing (UAT)
**Objective:** Verify application meets business requirements from user perspective

**Scope:**
- End-to-end workflows (create account → create listing → payment)
- Business rule validation
- User experience validation
- Data consistency across workflows

**Tools:** Cypress or Playwright (recommended: Cypress)

**Timeline:** Mar 1 - Mar 8, 2026

#### System Integration Testing
**Objective:** Verify all system components work together

**Scope:**
- Frontend ↔ Backend API communication
- Database transaction consistency
- Third-party API integration (Stripe, HandyAPI)
- Authentication across components

**Tools:** Cypress + API mocking, Postman

**Timeline:** Mar 5 - Mar 12, 2026

#### Cross-Browser Testing
**Objective:** Verify application works across browsers

**Scope:**
- Chrome (latest two versions)
- Firefox (latest version)
- Safari (latest version)
- Edge (latest version)
- Mobile browsers (iOS Safari, Chrome Android)

**Tools:** BrowserStack or local testing

**Timeline:** Mar 10 - Mar 15, 2026

### 2.2 Test Scenarios

#### Scenario 1: User Registration → Listing Creation → Payment

```gherkin
Feature: Complete User Journey

Scenario: New user creates listing and pays for premium
  Given I am on the login page
  When I register with email "test@example.com" and password "SecurePass123"
  And I verify my phone number via SMS
  And I navigate to "Create Listing"
  And I enter listing details:
    | Field | Value |
    | Title | My Garage Sale |
    | Description | Vintage items for sale |
    | Address | 42 Main Street, Sydney NSW 2000 |
    | Date | Next Saturday 9am-4pm |
  And I upload 3 images of items
  And I click "Create Listing"
  Then listing should appear in my listings
  And I should be able to upgrade to Premium
  When I click "Upgrade to Premium"
  And I complete Stripe payment with test card
  Then payment should be confirmed
  And premium features should be enabled
```

**Pass Criteria:**
- All steps complete without error
- Data persisted in Firestore
- UI updates reflect new state
- Stripe webhook received and processed
- Email confirmation sent

---

#### Scenario 2: Browse → Filter → View → Favorite → Contact

```gherkin
Scenario: User browses listings and saves favorite
  Given I am logged in
  When I navigate to browse listings
  And I search for listings in "Crows Nest, NSW"
  And I filter by distance "5km"
  Then I should see 5-10 relevant listings
  When I click on first listing
  Then listing details page should load with:
    | Element | Status |
    | Title and description | Visible |
    | Images carousel | Functional |
    | Map with location | Displays correctly |
    | Seller contact info | Visible |
    | Save/Favorite button | Clickable |
  When I click favorite button
  Then listing should appear in "My Favorites"
```

**Pass Criteria:**
- Search returns correct results
- Map displays accurate location
- Favorite adds/removes correctly
- Performance < 2 seconds

---

#### Scenario 3: Admin Moderation Workflow

```gherkin
Scenario: Admin reviews and approves user-generated content
  Given I am logged in as admin
  When I navigate to Admin Dashboard
  Then I should see:
    | Section | Data |
    | Pending Listings | Count and list |
    | User Reports | Count and list |
    | Payment Transactions | List with status |
  When I click on pending listing
  Then I should see full listing details
  When I click "Approve"
  Then listing status should change to "Active"
  And listing should become visible to other users
```

**Pass Criteria:**
- Admin has exclusive access
- All moderation actions work
- Status changes reflect in real-time
- User receives notification

---

### 2.3 Critical Paths to Test

1. **Authentication Path** (high priority)
   - Register → Verify → Login → Stay logged in → Logout
   - Reset password flow
   - Phone verification timeout handling

2. **Listing Creation Path** (high priority)
   - Create → Upload images → Publish → Edit → Delete
   - Image optimization validation
   - Data validation (address, date/time)

3. **Payment Path** (critical)
   - Stripe checkout initiation
   - Payment processing
   - Webhook verification
   - Receipt/confirmation email

4. **Search & Filter Path** (high priority)
   - Suburb search autocomplete
   - Distance filtering
   - Map display
   - Real-time result updates

---

## 3. Test Environment Setup

### 3.1 Cypress Installation & Configuration

```bash
# Install Cypress
cd web-app
npm install --save-dev cypress

# Generate cypress.config.js
npx cypress open

# Create test directory structure
mkdir cypress/{e2e,support,fixtures}
```

### 3.2 Cypress Configuration (cypress.config.js)

```javascript
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    screenshotOnRunFailure: true,
    videoOnFailure: true,
    defaultCommandTimeout: 5000,
    pageLoadTimeout: 10000,
    viewportWidth: 1280,
    viewportHeight: 720,
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
  },
});
```

### 3.3 Test Data & Fixtures

```javascript
// cypress/fixtures/testUser.json
{
  "email": "testuser@example.com",
  "password": "TestPass123!",
  "phone": "+61412345678",
  "firstName": "Test",
  "lastName": "User"
}

// cypress/fixtures/testListing.json
{
  "title": "Estate Sale Items",
  "description": "Quality vintage furniture and collectibles",
  "address": "42 Main Street, Crows Nest NSW 2000",
  "date": "2026-03-20",
  "startTime": "09:00",
  "endTime": "16:00",
  "categories": ["Furniture", "Collectibles"]
}
```

---

## 4. Cypress Test Examples

### 4.1 Authentication Tests

```javascript
// cypress/e2e/auth.cy.js
describe('Authentication Workflow', () => {
  
  it('should register new user', () => {
    cy.visit('/login');
    cy.contains('Register').click();
    cy.get('input[name="email"]').type('newuser@test.com');
    cy.get('input[name="password"]').type('SecurePass123');
    cy.get('input[name="confirmPassword"]').type('SecurePass123');
    cy.contains('Sign Up').click();
    
    // Verify success
    cy.contains('Verification Code').should('be.visible');
    cy.get('input[name="verificationCode"]').type('123456');
    cy.contains('Verify').click();
    cy.url().should('include', '/home');
  });

  it('should persist session on refresh', () => {
    cy.login('test@example.com', 'TestPass123');
    cy.url().should('include', '/home');
    
    cy.reload();
    cy.url().should('include', '/home');
    cy.contains('My Listings').should('be.visible');
  });

  it('should logout successfully', () => {
    cy.login('test@example.com', 'TestPass123');
    cy.contains('Profile').click();
    cy.contains('Logout').click();
    cy.url().should('include', '/login');
  });
});
```

### 4.2 Listing Creation Tests

```javascript
// cypress/e2e/listings.cy.js
describe('Listing Creation Workflow', () => {
  
  beforeEach(() => {
    cy.login('test@example.com', 'TestPass123');
    cy.visit('/create-listing');
  });

  it('should create listing with images', () => {
    cy.get('input[name="title"]').type('My Garage Sale');
    cy.get('textarea[name="description"]').type('Quality items for sale');
    cy.get('input[name="address"]').type('42 Main Street, Crows Nest NSW 2000');
    cy.get('input[name="date"]').type('2026-03-20');
    cy.get('input[name="startTime"]').type('09:00');
    cy.get('input[name="endTime"]').type('16:00');
    
    // Upload images
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-image-1.jpg');
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-image-2.jpg');
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-image-3.jpg');
    
    // Submit
    cy.contains('Create Listing').click();
    
    // Verify success
    cy.contains('Listing created successfully').should('be.visible');
    cy.url().should('include', '/my-listings');
  });

  it('should validate required fields', () => {
    cy.contains('Create Listing').click();
    cy.contains('Title is required').should('be.visible');
    cy.contains('Address is required').should('be.visible');
  });

  it('should accept valid dates only', () => {
    cy.get('input[name="date"]').type('2025-01-01'); // Past date
    cy.contains('Date must be in future').should('be.visible');
  });
});
```

### 4.3 Payment Tests

```javascript
// cypress/e2e/payment.cy.js
describe('Payment Workflow', () => {
  
  it('should process stripe payment', () => {
    cy.login('test@example.com', 'TestPass123');
    cy.visit('/listing/123');
    cy.contains('Upgrade to Premium').click();
    
    // Stripe iframe
    cy.get('iframe[title="Secure payment input frame"]').then($iframe => {
      const $body = $iframe.contents().find('body');
      cy.wrap($body).find('input[name="cardnumber"]').type('4242424242424242');
      cy.wrap($body).find('input[name="exp-date"]').type('1225');
      cy.wrap($body).find('input[name="cvc"]').type('123');
    });
    
    cy.contains('Pay Now').click();
    
    // Verify success
    cy.contains('Payment successful').should('be.visible');
    cy.contains('Premium listing activated').should('be.visible');
  });
});
```

---

## 5. API Testing with Postman

### 5.1 API Test Suite

```javascript
// API endpoint tests
POST /api/auth/register
POST /api/auth/login
GET /api/listings?suburb=Sydney&distance=5
POST /api/listings (create)
PUT /api/listings/:id (update)
DELETE /api/listings/:id
POST /api/payments/create-checkout
POST /api/payments/verify-webhook
GET /api/admin/users (admin only)
```

### 5.2 Example Test

```javascript
// Postman test script
pm.test("Create listing returns 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response contains listing ID", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.listingId).to.exist;
});

pm.test("Listing saved to Firestore", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.firestoreDocId).to.match(/^[a-zA-Z0-9]+$/);
});
```

---

## 6. Performance Testing Criteria

### 6.1 Target Metrics

| Metric | Target | Acceptable | Unacceptable |
|--------|--------|-----------|--------------|
| **Page Load Time** | < 2 sec | < 3 sec | > 3 sec |
| **API Response** | < 500 ms | < 1 sec | > 1 sec |
| **Image Load** | < 1 sec | < 2 sec | > 2 sec |
| **Stripe Checkout** | < 3 sec | < 5 sec | > 5 sec |
| **Search Results** | < 1 sec | < 2 sec | > 2 sec |

### 6.2 Load Testing

```bash
# Using Artillery for load testing
npm install -g artillery

# Create artillery.yml
config:
  target: "http://localhost:5173"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Ramp up load"
    - duration: 60
      arrivalRate: 100
      name: "Sustained"

scenarios:
  - name: "Listing Browse Flow"
    flow:
      - get:
          url: "/listings"
      - get:
          url: "/listings/123"

# Run test
artillery run artillery.yml --output results.json
```

---

## 7. Success Criteria & Exit Gates

### 7.1 Phase 4 Completion Criteria

- [ ] 100% critical path coverage in Cypress
- [ ] Zero critical/high defects found
- [ ] All scenarios passing on Chrome, Firefox, Safari
- [ ] Mobile responsive design verified
- [ ] Performance metrics met (< 3 sec page load)
- [ ] Test report documented
- [ ] Stakeholder sign-off obtained

### 7.2 Known Limitations

| Limitation | Reason | Workaround |
|-----------|--------|-----------|
| No real Stripe charges | Safety/compliance | Use Stripe test environment |
| Firebase depends on live project | Integration requirement | Use Firebase emulator where possible |
| Manual SMS verification | Third-party service | Skip SMS tests, test code entry only |

---

## 8. Timeline

| Phase | Task | Start | End | Owner |
|-------|------|-------|-----|-------|
| **Setup** | Install Cypress, write config | Mar 1 | Mar 2 | Dev |
| **Auth Tests** | Write & pass auth E2E tests | Mar 3 | Mar 4 | Dev |
| **Listing Tests** | Write & pass listing workflow tests | Mar 5 | Mar 8 | Dev |
| **Payment Tests** | Write & pass payment flow tests | Mar 9 | Mar 10 | Dev |
| **Cross-Browser** | Test on Chrome, Firefox, Safari | Mar 11 | Mar 13 | QA |
| **Performance** | Load testing & optimization | Mar 13 | Mar 14 | DevOps |
| **Report & Sign-Off** | Document results, stakeholder approval | Mar 15 | Mar 15 | QA |

---

## 9. Deliverables

- [ ] cypress/ directory with E2E test suites
- [ ] cypress/e2e/ - All test files
- [ ] cypress/support/ - Helper functions
- [ ] cypress.config.js - Configuration
- [ ] Cypress test execution report
- [ ] Cross-browser test matrix
- [ ] Performance test results
- [ ] System Testing Report (formal document)

---

## 10. References

- [Cypress Documentation](https://docs.cypress.io)
- [Playwright Documentation](https://playwright.dev) (alternative)
- [Postman API Testing](https://learning.postman.com)
- [Artillery Load Testing](https://artillery.io)

---

**Document Control:**
- Version: 1.0 | Date: 26 Feb 2026 | Status: Implementation Plan
- Timeline: Phase 4 (Mar 1-15, 2026)
- Next Update: Post-Phase 4 completion
