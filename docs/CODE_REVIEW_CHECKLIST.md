# Code Review Checklist

**Purpose**: Ensure all code changes meet quality, testing, and documentation standards  
**Scope**: Pull requests to `main`, `develop`, and feature branches  
**Review Time**: ~10-15 minutes per PR after automated checks pass

---

## Pre-Review Checklist (Automated)

These checks run automatically on every PR via GitHub Actions:

- [ ] **Build**: Code compiles without errors
- [ ] **Lint**: ESLint passes with no warnings
- [ ] **Tests**: All tests pass (267+ test cases)
- [ ] **Coverage**: Meets configured thresholds
  - Global: 2% minimum
  - Utils: 100% if modified
- [ ] **Security**: No known vulnerabilities in dependencies

**Result**: ✅ CI pass required before manual review

---

## Testing Requirements

### ✅ All Changes Must Have Tests

| Change Type | Test Requirement | Examples |
|------------|-----------------|----------|
| **New Feature** | Unit + Integration | New auth method, API endpoint |
| **Bug Fix** | Test that reproduces bug | Login validation, payment flow |
| **Refactor** | Maintain existing coverage | Function extraction, hook decomposition |
| **Test Fix** | Explain why test changed | Mock update, assertion refinement |
| **Docs Only** | N/A | README, TESTING_STRATEGY.md |

### ✅ Test Quality Checklist

- [ ] Tests **pass locally**: `npm test`
- [ ] Tests **show intent clearly** (good test names)
- [ ] Tests **cover happy path**: Feature works as designed
- [ ] Tests **cover error cases**: Validation, network errors, edge cases
- [ ] Tests **are isolated**: No test dependencies, no shared state
- [ ] Tests **mock external APIs**: Firebase, Stripe, HandyAPI
- [ ] **No skipped tests** unless documented with reason
- [ ] **No console errors** in test output

### Example: Good Test Structure

```javascript
describe('Login - Sign In Feature', () => {
  describe('Form Validation', () => {
    test('should require email address', async () => {
      // Arrange: Setup component
      render(<Login />);
      
      // Act: Try to submit without email
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      
      // Assert: Form validation prevents submission
      expect(screen.getByText(/email required/i)).toBeInTheDocument();
      expect(firebase.auth.login).not.toHaveBeenCalled();
    });
  });

  describe('Successful Login', () => {
    test('should navigate to dashboard after successful login', async () => {
      // Setup mock to return successful user
      firebase.auth.login.mockResolvedValueOnce({ uid: 'user_123' });

      render(<Login />);
      const user = userEvent.setup();

      // Act: Submit valid credentials
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'SecurePass123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Assert: Navigation occurs
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Error Handling', () => {
    test('should show error message on invalid credentials', async () => {
      // Setup mock to return error
      firebase.auth.login.mockRejectedValueOnce(
        new Error('Invalid email or password')
      );

      render(<Login />);
      const user = userEvent.setup();

      // Act: Submit invalid credentials
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Assert: Error message displays
      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });
    });
  });
});
```

---

## Code Quality Checklist

### ✅ Code Standards

- [ ] **No hardcoded values**: Use constants, env vars, or config
- [ ] **No commented-out code**: Delete or create issue to fix later
- [ ] **No console.log in production**: Remove debug logs
- [ ] **No duplicate code**: Extract to utility function
- [ ] **Meaningful variable names**: `user` not `u`, `isLoading` not `l`
- [ ] **Comments for why, not what**: Code should explain what, comments explain why
- [ ] **PropTypes or TypeScript**: Type safety for components
- [ ] **Error handling**: Try/catch, error boundaries, user feedback

### ✅ React Best Practices

- [ ] **Hooks used correctly**: Dependencies listed in useEffect
- [ ] **No infinite loops**: Check useEffect dependencies
- [ ] **Fragments for multiple children**: `<>` not `<div>`
- [ ] **Key prop on list items**: Required for list rendering
- [ ] **Controlled vs uncontrolled forms**: Consistent pattern
- [ ] **Accessibility attributes**: Labels, roles, ARIA where needed
- [ ] **No direct DOM manipulation**: Use React refs

### ✅ Firebase Integration

- [ ] **Auth before data access**: Check `isAuthenticated` before queries
- [ ] **Error handling for auth**: User feedback on auth failures
- [ ] **Firestore queries optimized**: Indexed, limited results
- [ ] **Storage paths secured**: User ID in path where applicable
- [ ] **No sensitive data in logs**: Don't log passwords, tokens

### ✅ Testing Best Practices

- [ ] **Stable selectors**: Use `getByRole`, `getByLabelText`, avoid `getByTestId` where possible
- [ ] **No waitFor for UI state**: Use `waitFor` for async operations, not immediate state
- [ ] **Mock at module level**: jest.mock() at top of file
- [ ] **Clear mock setup**: What is each mock expected to return?
- [ ] **Teardown in beforeEach/afterEach**: jest.clearAllMocks()
- [ ] **No unnecessary act() calls**: Only for test library <14 edge cases

---

## Documentation Requirements

### ✅ Comments and Docs

- [ ] **README updated** (if adding new feature)
- [ ] **API documentation** (if adding new endpoint)
- [ ] **Component prop documentation** (JSDoc comment)
- [ ] **Complex logic explained**: Why did we do it this way?

### Example: Good JSDoc

```javascript
/**
 * Calculate distance between two geographic coordinates
 * Uses Haversine formula for great-circle distance
 * 
 * @param {number} lat1 - First latitude (-90 to 90)
 * @param {number} lon1 - First longitude (-180 to 180)
 * @param {number} lat2 - Second latitude (-90 to 90)
 * @param {number} lon2 - Second longitude (-180 to 180)
 * @returns {number} Distance in kilometers
 * @throws {Error} If coordinates are invalid
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  // Implementation
}
```

---

## Performance Checklist

### ✅ Performance Standards

- [ ] **No unnecessary re-renders**: Check useMemo/useCallback usage
- [ ] **Image optimization**: Compressed, responsive sizes
- [ ] **Bundle size impact**: Check before adding large dependencies
- [ ] **Async data loading**: Don't block render, show loading state
- [ ] **No memory leaks**: Cleanup listeners, timers in useEffect
- [ ] **Lazy load heavy components**: React.lazy() for route components

---

## Security Checklist

### ✅ Security Standards

- [ ] **No hardcoded secrets**: Use environment variables
- [ ] **Input validation**: Sanitize user data, validate types
- [ ] **SQL injection prevention**: Use parameterized queries (Firestore does this)
- [ ] **XSS prevention**: Never use dangerouslySetInnerHTML
- [ ] **CORS configured**: Only trusted domains
- [ ] **Sensitive data not logged**: No passwords, tokens, payment info in logs
- [ ] **Firebase rules verified**: Test.mode rule not in production
- [ ] **Stripe PCI compliance**: No raw card data in code

---

## Browser & Device Compatibility

### ✅ Tested On

- [ ] **Modern browsers** (Chrome, Firefox, Safari, Edge - latest versions)
- [ ] **Mobile devices** (iOS Safari, Android Chrome)
- [ ] **Responsive design** (tested at 320px, 768px, 1024px)
- [ ] **Accessibility** (keyboard navigation, screen reader friendly)

---

## PR Description Template

Every PR should include:

```markdown
## Ticket
Closes #123

## Summary
[2-3 sentence description of changes]

## Changes
- [ ] New feature: [description]
- [ ] Bug fix: [description]
- [ ] Refactor: [description]
- [ ] Documentation: [description]

## Testing
- Tested on: [device/browser]
- Test cases: [number of new tests]
- Coverage: [% covered]

## Screenshots/Demo
[If UI changes]

## Checklist
- [ ] All tests pass
- [ ] No console errors
- [ ] Documented changes
- [ ] Ready for production
```

---

## Review Comment Examples

### ✅ Constructive Comments

**Good**: "This could be extracted to a utility function to avoid duplication in [other files]"  
**Bad**: "This is duplicated code"

**Good**: "I notice handleSubmit could have a race condition if submitted twice rapidly. Consider adding `disabled={isSubmitting}` state"  
**Bad**: "Bad code pattern"

**Good**: "Thanks for adding the error handling! Could you also add a test for the network timeout case?"  
**Bad**: "You forgot a test"

---

## Approval Criteria

### PR Must Have:

- ✅ **All CI checks passing** (build, lint, tests, coverage)
- ✅ **At least 1 approval** from code owner
- ✅ **All conversations resolved**
- ✅ **Branch up to date** with main
- ✅ **No merge conflicts**

### Optional but Appreciated:

- ⭐ Tests exceed threshold (80%+ on changes)
- ⭐ Clear, detailed commit messages
- ⭐ Screenshots/GIFs for UI changes
- ⭐ Performance metrics if applicable

---

## Common Review Findings

### Frequency Check

| Finding | Frequency | Prevention |
|---------|-----------|-----------|
| Missing tests | Very High | Require CI pass before review |
| Hardcoded values | High | Template constants, eslint rules |
| Missing error handling | Medium | Add firebase.catch() reminder |
| Comment-heavy code | Medium | Refactor for clarity first |
| Unused imports | Medium | ESLint auto-fix |

---

## Fast-Track Review Items

These PRs get expedited review if they:

- ✅ Only modify tests (add/fix test cases)
- ✅ Only modify documentation (README, comments)
- ✅ Only fix linting/formatting issues
- ✅ Only update dependencies (with passing tests)

**Fast-track**: single approval needed, can merge within 1 hour

---

## Escalation Path

If there's a disagreement about a code change:

1. **Discuss privately**: 1-on-1 sync between reviewer and author
2. **Document decision**: Add comment explaining resolution
3. **Involve tech lead**: If still unresolved
4. **Document in docs**: Add to TESTING_STRATEGY.md if pattern-setting

---

## Metrics to Track

Every month, review:

- **PR Review Time**: Target < 24 hours
- **Test Coverage**: Trending towards 80%+ on critical paths
- **Failed Builds**: Target < 5% of PRs
- **Rework Rate**: Percentage of PRs needing revision
- **Test Quality**: Test-to-bug ratio (more comprehensive tests = fewer production bugs)

---

## Resources

- [Testing Strategy](./TESTING_STRATEGY.md)
- [Jest Documentation](https://jestjs.io/)
- [React Testing Library Guide](https://testing-library.com/react)
- [Firebase Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [React Hooks Rules](https://react.dev/reference/react/hooks)

---

**Last Updated**: February 26, 2026  
**Maintained By**: Development Team  
**Review Frequency**: Quarterly
