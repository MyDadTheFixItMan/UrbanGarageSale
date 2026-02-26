# Test Suite Documentation

## Overview
Comprehensive test suite for UrbanGarageSale marketplace application covering all major features and user workflows.

**Test Infrastructure**: Jest + React Testing Library + Firebase Mocks
**Coverage Target**: 70%+ for core features
**Test Files**: 10 feature/component test files

---

## Test Structure

```
src/__tests__/
├── mocks/
│   └── firebase.js                 # Firebase mock implementation
├── utils/
│   └── test-utils.jsx             # renderWithProviders utility
├── features/
│   ├── authentication.test.js      # User auth workflows
│   ├── listings.test.js            # Listing CRUD & search
│   ├── payments.test.js            # Stripe integration
│   ├── emailNotifications.test.js  # SendGrid email service
│   ├── fileUpload.test.js          # Image upload & compression
│   ├── savedListings.test.js       # Favorites feature
│   └── administration.test.js      # Admin & moderation
├── components/
│   └── CreateListing.test.js       # Form component tests
└── integration/
    └── workflows.test.js           # End-to-end user workflows
```

---

## Test Coverage by Feature

### 1. Authentication Tests (`authentication.test.js`)
- **Auth Status**: Check if user is authenticated (true/false cases)
- **User Profile**: Fetch profile, null handling
- **Login**: Valid credentials, error handling
- **Logout**: Logout flow

**Test Count**: ~10 tests
**Coverage**: Auth context, Firebase auth integration

### 2. Listing Management Tests (`listings.test.js`)
- **Creation**: Create with valid data, required fields, unique IDs
- **Retrieval**: Fetch by ID, fetch all, handle not found
- **Filtering**: By sale type, suburb, multiple criteria, empty results
- **Search**: By title, description, case-insensitive
- **Updates**: Update single/multiple fields, immutable field protection
- **Deletion**: Delete by ID, non-existent handling, image cleanup
- **Status**: Track approval status (pending/approved/rejected)
- **Coordinates**: Store location data, calculate distance

**Test Count**: ~35 tests
**Coverage**: CRUD operations, business logic, data validation

### 3. Payment Flow Tests (`payments.test.js`)
- **Stripe Checkout**: Create session, validate required fields, validate amounts
- **Verification**: Verify webhooks, handle failures
- **Storage**: Store payment records in Firestore
- **Status Tracking**: Fetch by ID, track history, calculate revenue
- **Refunds**: Initiate refund, reject invalid, update status
- **Error Handling**: API errors, network timeouts, retry logic
- **Currency & Amounts**: Accept AUD, convert to cents, format display

**Test Count**: ~30 tests
**Coverage**: Payment integration, error handling, amount validation

### 4. Email Notifications Tests (`emailNotifications.test.js`)
- **Service**: Send confirmation emails, seller notifications, invalid emails
- **Templates**: Correct templates, render with data
- **Delivery**: Track status, handle failures, retry logic
- **History**: Store in Firestore
- **Notification Workflow**: Send to both parties, include details
- **Admin Notifications**: Approval/rejection emails
- **Error Handling**: API errors, missing config, validation
- **Bulk Operations**: Batch send, partial failures

**Test Count**: ~28 tests
**Coverage**: SendGrid integration, template rendering, error handling

### 5. File Upload & Compression Tests (`fileUpload.test.js`)
- **Compression**: Compress images, non-image handling, aspect ratio
- **File Size**: Format bytes, round decimals
- **Cloud Storage**: Upload to Cloud Storage, error handling, multiple files
- **Validation**: Accept image formats, reject invalid, size limits
- **Canvas Mocking**: Mock HTML5 canvas for tests

**Test Count**: ~15 tests
**Coverage**: Image processing, upload pipeline, validation

### 6. Saved Listings Tests (`savedListings.test.js`)
- **Save**: Save listing, prevent duplicates, timestamp
- **Remove**: Delete from saved, non-existent handling
- **Fetch**: Get all per user, empty results, count
- **Status**: Check if saved, return true/false
- **Toggle**: Toggle favorite on/off
- **List Display**: Show details, sort by date, bulk operations
- **Notifications**: Sale notifications, ending soon, price changes
- **Collections**: Create custom, add/remove listings
- **Export**: CSV export, shareable links

**Test Count**: ~34 tests
**Coverage**: Favorite system, collection management

### 7. Administration Tests (`administration.test.js`)
- **Dashboard**: Load for admins, restrict to admins, metrics
- **Approval**: Fetch pending, approve, reject with reason, request changes
- **Users**: View all, suspend, ban, reactivate
- **Content Moderation**: Flag, remove, spam detection, language filter
- **Reports**: Create, investigate, resolve, track
- **Metrics**: Total listings, revenue, active users, trending suburbs
- **Logging**: Log admin actions, audit trail
- **Permissions**: Restrict actions, super admin capabilities

**Test Count**: ~40 tests
**Coverage**: Admin workflows, moderation, analytics

### 8. CreateListing Component Tests (`CreateListing.test.js`)
- **Rendering**: All form fields, submit button, upload section
- **Validation**: Required fields, description length, suburb validation, sale type
- **Images**: File selection, reject non-images, multiple uploads, loading state
- **Suburb Autocomplete**: Show suggestions, select from list
- **Form Submission**: Submit valid data, success/error messages
- **Integration**: Form with all providers

**Test Count**: ~25 tests
**Coverage**: Component rendering, form validation, user interactions

### 9. Integration Tests (`workflows.test.js`)
- **Seller Flow**: Create listing → Upload images → Admin approval → Email
- **Buyer Flow**: Login → Search → Save listing → Purchase → Confirmation
- **Dispute Flow**: Report → Investigate → Resolve → Refund
- **Moderation**: Flag suspicious → Review → Reject → Notify
- **Registration**: Email verification → Phone → Profile setup
- **Listing Lifecycle**: Draft → Pending → Approved → Active → Completed
- **Notifications**: All event-triggered emails
- **Data Sync**: Cross-session data consistency
- **Error Recovery**: Payment failures, upload retries
- **Concurrent Operations**: Handle parallel operations

**Test Count**: ~40 tests
**Coverage**: Complete user journeys, system integration

---

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test authentication.test.js
```

### Run with Coverage Report
```bash
npm test -- --coverage
```

### Watch Mode (Auto-rerun on changes)
```bash
npm test -- --watch
```

### Run Integration Tests Only
```bash
npm test -- --testPathPattern=integration
```

### Run Feature Tests Only
```bash
npm test -- --testPathPattern=features
```

---

## Test Patterns & Best Practices

### Mock Setup
```javascript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Firebase Mocking
All Firebase operations are mocked to prevent external dependencies:
```javascript
firebase.entities.GarageSale.create.mockResolvedValue({ id: 'listing_123' });
firebase.auth.login.mockResolvedValue({ id: 'user_123' });
```

### Component Testing
Components are rendered with providers:
```javascript
render(<CreateListing />);
```

### User Interactions
```javascript
await userEvent.type(screen.getByLabelText(/title/i), 'Sale Title');
fireEvent.click(screen.getByRole('button', { name: /submit/i }));
```

### Async Testing
```javascript
await waitFor(() => {
  expect(screen.getByText(/success/i)).toBeInTheDocument();
});
```

---

## Coverage Thresholds

Jest is configured to enforce minimum coverage:
- **Branches**: 50%
- **Functions**: 50%
- **Lines**: 50%
- **Statements**: 50%

Target coverage for production: 70%+

---

## Dependencies

```json
{
  "jest": "^29.0.0",
  "@testing-library/react": "^14.0.0",
  "@testing-library/jest-dom": "^6.0.0",
  "@testing-library/user-event": "^14.0.0",
  "babel-jest": "^29.0.0",
  "identity-obj-proxy": "^3.0.0"
}
```

---

## Test Organization

### By Feature
- Authentication
- Listings (CRUD, search, filter)
- Payments (Stripe integration)
- Email (SendGrid)
- Files (upload, compression)
- Favorites
- Admin/Moderation

### By Scope
- **Unit Tests**: Individual functions, mocks, validation
- **Component Tests**: React component rendering, user interactions
- **Integration Tests**: Complete workflows, multiple components

### By Concern
- Happy path (everything works)
- Error cases (failures, validation)
- Edge cases (empty results, duplicates, timeouts)

---

## Common Test Scenarios

### Testing Async Operations
```javascript
test('should create listing', async () => {
  const listing = await firebase.entities.GarageSale.create(data);
  expect(listing.id).toBeTruthy();
});
```

### Testing Form Validation
```javascript
test('should show error for empty title', async () => {
  const input = screen.getByLabelText(/title/i);
  expect(input).toHaveAttribute('required');
});
```

### Testing API Calls
```javascript
test('should call API with correct data', async () => {
  await firebase.entities.GarageSale.create(data);
  expect(firebase.entities.GarageSale.create).toHaveBeenCalledWith(data);
});
```

### Testing Error Handling
```javascript
test('should handle API error', async () => {
  firebase.entities.GarageSale.create.mockRejectedValueOnce(
    new Error('API Error')
  );
  await expect(firebase.entities.GarageSale.create({}))
    .rejects.toThrow('API Error');
});
```

---

## Continuous Integration

Tests should run on every:
- ✅ Git commit (pre-commit hook)
- ✅ Pull request (CI/CD pipeline)
- ✅ Before deployment (must pass)
- ✅ Scheduled daily runs

Example GitHub Actions workflow:
```yaml
- run: npm test -- --coverage
- run: npm test -- --coverage --testPathPattern=integration
```

---

## Troubleshooting

### Canvas Mock Issues
Canvas is mocked in `setupTests.js` for image compression tests

### Async Timeout
Increase timeout in waitFor:
```javascript
await waitFor(() => { ... }, { timeout: 5000 });
```

### Mock Not Applied
Always call `jest.clearAllMocks()` in `beforeEach`

### Component Not Rendering
Ensure component is wrapped with `renderWithProviders`

---

## Future Enhancements

- [ ] E2E tests with Cypress
- [ ] Performance testing
- [ ] Visual regression testing
- [ ] Mobile/responsive testing
- [ ] Accessibility testing (a11y)
- [ ] Load testing
- [ ] Security testing (OWASP)

---

## Test Metrics

**Current Status**:
- Total test files: 10
- Total test cases: ~285
- Coverage target: 70%+
- Estimated runtime: 30-45 seconds

**Quality Gates**:
- ✅ All tests must pass
- ✅ Coverage above thresholds
- ✅ No console errors
- ✅ No memory leaks

---

## Maintenance

### Monthly Tasks
- [ ] Review failing tests
- [ ] Update mocks for API changes
- [ ] Expand coverage to new features
- [ ] Performance optimization

### When Changing Code
- [ ] Update corresponding tests
- [ ] Add tests for new features
- [ ] Ensure coverage maintained
- [ ] Run full suite before commit

---

**Version**: 1.0
**Last Updated**: 2024-03-15
**Maintained By**: Development Team
