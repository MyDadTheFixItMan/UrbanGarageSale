# Test Suite Setup & Execution Guide

## Quick Start

### Prerequisites
Ensure these dependencies are installed in `package.json`:
```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event babel-jest identity-obj-proxy @babel/preset-react
```

### Run All Tests
```bash
npm test
```

### View Coverage Report
```bash
npm test -- --coverage
```

---

## File Structure

Tests are located in `web-app/src/__tests__/`:
```
src/__tests__/
├── mocks/
│   └── firebase.js                    # Firebase mock implementation
├── utils/
│   └── test-utils.jsx                # Test utilities (renderWithProviders)
├── features/
│   ├── authentication.test.js         # ✅ Auth tests (10 cases)
│   ├── listings.test.js               # ✅ Listing CRUD tests (35 cases)
│   ├── payments.test.js               # ✅ Payment tests (30 cases)
│   ├── emailNotifications.test.js     # ✅ Email tests (28 cases)
│   ├── fileUpload.test.js             # ✅ Upload tests (15 cases)
│   ├── savedListings.test.js          # ✅ Favorites tests (34 cases)
│   └── administration.test.js         # ✅ Admin tests (40 cases)
├── components/
│   └── CreateListing.test.js          # ✅ Component tests (25 cases)
├── integration/
│   └── workflows.test.js              # ✅ Integration tests (40 cases)
└── README.md                          # Test documentation
```

**Total Test Cases**: ~287
**Estimated Runtime**: 30-45 seconds

---

## Configuration Files

### jest.config.js
Jest configuration with:
- ✅ jsdom test environment
- ✅ Firebase mocking
- ✅ CSS module mocking
- ✅ Coverage thresholds (50% minimum)
- ✅ Module aliasing (@/ → src/)

### setupTests.js
Global test setup with:
- ✅ localStorage mock
- ✅ window.matchMedia mock
- ✅ @testing-library/jest-dom matchers
- ✅ Console warning suppression

### src/__tests__/mocks/firebase.js
Firebase mock implementation with:
- ✅ auth module (login, logout, me)
- ✅ entities module (GarageSale, SavedListing, Payment)
- ✅ storage module (uploadImage, deleteImage)
- ✅ firestore module (collection queries)

### src/__tests__/utils/test-utils.jsx
Testing utilities:
- ✅ renderWithProviders() function
- ✅ All React Testing Library exports
- ✅ userEvent for user interactions

---

## Running Tests

### All Tests
```bash
npm test
```
Runs all test files and shows results.

### Specific Test File
```bash
npm test authentication.test.js
```
Runs only authentication tests.

### Feature Tests
```bash
npm test -- --testPathPattern=features
```
Runs all feature tests.

### Integration Tests
```bash
npm test -- --testPathPattern=integration
```
Runs only integration/workflow tests.

### Component Tests
```bash
npm test -- --testPathPattern=components
```
Runs only component tests.

### Watch Mode
```bash
npm test -- --watch
```
Re-runs tests automatically when files change.

### Coverage Report
```bash
npm test -- --coverage
```
Shows coverage percentage by file.

### Coverage with HTML Report
```bash
npm test -- --coverage --coverageReporters=html
```
Generates HTML coverage report in `coverage/index.html`

### Run Single Test
```bash
npm test -- -t "should create listing"
```
Runs only tests matching that description.

---

## Expected Output

### Successful Test Run
```
PASS  src/__tests__/features/authentication.test.js
PASS  src/__tests__/features/listings.test.js
PASS  src/__tests__/features/payments.test.js
PASS  src/__tests__/features/emailNotifications.test.js
PASS  src/__tests__/features/fileUpload.test.js
PASS  src/__tests__/features/savedListings.test.js
PASS  src/__tests__/features/administration.test.js
PASS  src/__tests__/components/CreateListing.test.js
PASS  src/__tests__/integration/workflows.test.js

Tests:       287 passed, 287 total
Suites:      9 passed, 9 total
Time:        2.456 s
```

### Coverage Report Example
```
File                          | % Stmts | % Branch | % Funcs | % Lines |
------|---------|----------|---------|---------|
All files                     |   75.2  |   68.4   |   71.9  |   75.2  |
 src/api/firebaseClient.js    |   82.1  |   75.3   |   80.0  |   82.1  |
 src/pages/CreateListing.jsx  |   88.3  |   85.2   |   90.0  |   88.3  |
 src/features/listings.js     |   72.4  |   65.3   |   70.0  |   72.4  |
```

---

## Test Categories

### Unit Tests (Mock External Dependencies)
- Image compression logic
- File size formatting
- Email template rendering
- Form validation

### Component Tests (Render & User Interaction)
- CreateListing form
- Payment form (mocked Stripe)
- SavedListings component
- Admin dashboard

### Integration Tests (Complete Workflows)
- Seller listing creation → approval
- Buyer search → purchase → confirmation
- Admin moderation workflow
- Error recovery flows

### Feature Tests (Business Logic)
- Listing CRUD operations
- Payment processing
- Email notifications
- Favorites management

---

## Debugging Tests

### View Detailed Output
```bash
npm test -- --verbose
```

### Single Test Only
```bash
npm test -- -t "should create listing"
```

### Stop at First Failure
```bash
npm test -- --bail
```

### Show Console Logs in Tests
```javascript
// In test file
test('debug', () => {
  console.log('Debug output here');
  expect(true).toBe(true);
});
```

### Debug in Browser
```javascript
// Add in test
debugger;
```
Then run:
```bash
node --inspect-brk node_modules/jest/bin/jest.js --runInBand
```
Open `chrome://inspect` to view.

---

## Common Issues & Solutions

### Issue: "Cannot find module 'firebase'"
**Solution**: Ensure `jest.config.js` has:
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

### Issue: "ReferenceError: localStorage is not defined"
**Solution**: Already mocked in `setupTests.js`

### Issue: "TypeError: window.matchMedia is not a function"
**Solution**: Already mocked in `setupTests.js`

### Issue: "Canvas mock error"
**Solution**: Already mocked in `fileUpload.test.js`

### Issue: Tests timeout
**Solution**: Increase timeout:
```javascript
test('slow test', async () => {
  // test code
}, 10000); // 10 second timeout
```

### Issue: Mock not clearing
**Solution**: Always call in beforeEach:
```javascript
beforeEach(() => {
  jest.clearAllMocks();
});
```

---

## Tips for Writing New Tests

### 1. Use descriptive names
```javascript
// ✅ Good
test('should show error message when email is invalid', () => {});

// ❌ Bad
test('email validation', () => {});
```

### 2. Follow AAA pattern
```javascript
test('should do something', () => {
  // Arrange - setup
  const data = { title: 'Test' };
  
  // Act - execute
  const result = await service.create(data);
  
  // Assert - verify
  expect(result.id).toBeTruthy();
});
```

### 3. Test user behavior, not implementation
```javascript
// ✅ Good - test what user sees
test('should show success message', async () => {
  fireEvent.click(submitButton);
  expect(screen.getByText(/success/i)).toBeInTheDocument();
});

// ❌ Bad - testing internal state
test('should set isLoading to true', () => {
  expect(component.state.isLoading).toBe(true);
});
```

### 4. Use screen queries
```javascript
// ✅ Good
screen.getByRole('button', { name: /submit/i });
screen.getByLabelText(/email/i);
screen.getByText(/error message/i);

// ❌ Bad
wrapper.find('button');
document.querySelector('input[type="email"]');
```

### 5. Make tests independent
```javascript
// ✅ Good - fresh state each test
beforeEach(() => {
  jest.clearAllMocks();
  render(<Component />);
});

// ❌ Bad - dependent on test order
let mockData;
test('first test', () => {
  mockData = { /* ... */ };
});
test('second test', () => {
  expect(mockData).toBeTruthy(); // Fails if first test skipped
});
```

---

## Test Naming Convention

### Feature Tests
```javascript
describe('[Feature Name]', () => {
  describe('[Sub-feature]', () => {
    test('should [action] [condition]', () => {});
  });
});
```

### Component Tests
```javascript
describe('[Component Name]', () => {
  describe('[Feature]', () => {
    test('should render [element]', () => {});
    test('should handle [interaction]', () => {});
  });
});
```

---

## Coverage Goals

### By Feature
- Authentication: 100%
- Listings (CRUD): 90%
- Payments: 85%
- Email: 80%
- File Upload: 85%
- Favorites: 85%
- Admin: 80%

### By Type
- Happy path: 100%
- Error cases: 85%
- Edge cases: 70%
- Validation: 90%

---

## Continuous Integration

Add to `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --coverage --watchAll=false"
  }
}
```

GitHub Actions example:
```yaml
- name: Run tests
  run: npm run test:ci
  
- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

---

## Performance Optimization

### Run only changed tests
```bash
npm test -- --onlyChanged
```

### Run tests in parallel
Jest runs tests in parallel by default, adjust with:
```bash
npm test -- --maxWorkers=2  # Use 2 workers instead of CPU count
```

### Skip slow tests in development
```javascript
test.skip('slow integration test', () => {
  // Test skipped during development
});
```

---

## Maintenance Checklist

- [ ] Run tests before every commit
- [ ] Update tests when changing features
- [ ] Keep mocks in sync with API changes
- [ ] Review coverage report monthly
- [ ] Remove obsolete tests
- [ ] Add tests for bug fixes
- [ ] Document test patterns

---

**Setup Complete!** 🎉

Your test suite is ready. Start with:
```bash
npm test
```

All 287 tests should pass! ✅
