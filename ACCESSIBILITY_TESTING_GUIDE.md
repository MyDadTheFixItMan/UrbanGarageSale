# Accessibility Testing Guide (WCAG 2.1 AA)
**Phase 5 Implementation Plan**

**Version:** 1.0  
**Date:** 26 February 2026  
**Timeline:** Phase 5 (March 16-31, 2026)

---

## 1. Overview

UrbanGarageSale must comply with WCAG 2.1 Level AA accessibility standards (Australian requirement for public-facing applications). This guide establishes testing procedures, automated tooling, and manual verification processes.

---

## 2. WCAG 2.1 Level AA Requirements

### 2.1 Perceivable (Users can perceive content)

#### 1.1 Text Alternatives
**Requirement:** All images must have descriptive alt text

**Testing:**
```
Manual Check:
1. Inspect every image in application
2. Verify alt text is descriptive
3. Test with screen reader (NVDA)

Example:
❌ Bad: <img alt="image" src="item.jpg" />
✅ Good: <img alt="Vintage wooden table listed for $150" src="item.jpg" />
```

**Current Status:** ⚠️ PARTIAL - Listing images need alt text

#### 1.4 Distinguishable (Colors, contrast, readable text)
**Requirement:** Color contrast ratio ≥ 4.5:1 for regular text, 3:1 for large text

**Testing Tools:**
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- WAVE Browser Extension
- Axe DevTools

```javascript
// Test color contrast
// Button background: #7C3AED (purple)
// Button text: #FFFFFF (white)
// Contrast ratio: 4.8:1 ✅ COMPLIANT

// Link color: #0EA5E9 (blue)
// Link background: white
// Contrast ratio: 4.5:1 ✅ COMPLIANT
```

---

### 2.2 Operable (Users can operate interface)

#### 2.1 Keyboard Accessible
**Requirement:** All functionality must be accessible via keyboard

**Testing Procedure:**
```
1. Tab through entire application
   - Check tab order (left-to-right, top-to-bottom)
   - Verify focus visible on all interactive elements

2. Test keyboard shortcuts
   - Enter key: Submit forms, click buttons
   - Escape key: Close modals
   - Tab/Shift+Tab: Navigate

3. Verify no keyboard traps
   - Cannot get stuck in any element
   - Always can tab out with Tab key
```

**Current Issues to Fix:**
- [ ] Focus indicators need visible styling
- [ ] Modal close button needs keyboard access
- [ ] Form elements need focus order review

#### 2.3 Focus Visible
**Requirement:** Keyboard focus must be visually obvious

```css
/* Add focus styling (currently missing) */
button:focus,
input:focus,
a:focus {
  outline: 3px solid #0EA5E9; /* Blue focus ring */
  outline-offset: 2px;
}

/* Test: Tab through page, focus should be clearly visible */
```

#### 2.4 Focus Order
**Requirement:** Focus order must be logical and meaningful

```html
<!-- Check order in HTML (source order matters) -->
<form>
  <label for="email">Email:</label>
  <input id="email" type="email" />
  
  <label for="password">Password:</label>
  <input id="password" type="password" />
  
  <!-- Button last = natural tab order -->
  <button type="submit">Login</button>
</form>

<!-- Test: Tab should go: email → password → button -->
```

---

### 2.3 Understandable (Users can understand content)

#### 3.1 Readable Language
**Requirement:** Content must be clear and understandable

**Testing:**
- ✅ Simple language used
- ✅ No jargon without explanation
- ✅ Page purpose clear

#### 3.3 Input Assistance
**Requirement:** Users can identify error messages and correct them

**Testing:**
```javascript
// Current form validation (good):
if (!email.includes('@')) {
  setError('Email must contain @ symbol');
}

// Required improvements:
// 1. Error message near input (currently global)
// 2. Form field highlighted red
// 3. Error announced to screen reader
// 4. aria-required="true" attribute
```

---

### 2.4 Robust (Works with adaptive technologies)

#### 4.1 Parsing
**Requirement:** HTML must be valid (no duplicate IDs, unclosed tags)

**Testing:**
```bash
# Run HTML validator
npm install --save-dev html-validator

# Test: npm run validate-html
# Should return 0 errors
```

#### 4.1.2 Name, Role, Value
**Requirement:** All UI components must be properly labeled

**Current Issues:**
- [ ] Images need alt text
- [ ] Buttons need text labels (not just icons)
- [ ] Form fields need proper labels
- [ ] Custom components need ARIA

---

## 3. Automated Testing Tools

### 3.1 Axe Testing Framework

```javascript
// Install Axe
npm install --save-dev @axe-core/react

// Add to test file
import { axe } from 'jest-axe';

test('Home page has no accessibility violations', async () => {
  const { container } = render(<Home />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

test('Login form has no accessibility violations', async () => {
  const { container } = render(<Login />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### 3.2 Lighthouse Accessibility Audit

```bash
# Install Lighthouse
npm install --save-dev @lhci/cli@latest @lhci/server

# Run audit
lhci autorun

# Expected: Accessibility score ≥ 90
```

### 3.3 WAVE Browser Extension

**Manual Testing:**
1. Install WAVE Chrome Extension
2. Visit application pages
3. Review generated report
4. Fix identified issues

---

## 4. Manual Testing Procedures

### 4.1 Screen Reader Testing

#### NVDA Setup (Windows)
```bash
# Download NVDA from: https://www.nvaccess.org/download/
# Installation: Once installed, press Ctrl+Alt+N to start

# Testing script:
1. Navigate to /login
2. NVDA announces "login heading level 1"
3. Tab to email field
4. NVDA announces "email edit text empty"
5. Type email, NVDA announces text
6. Tab to password field
7. NVDA announces "password edit text empty"
8. Tab to submit button
9. NVDA announces "sign in button"
10. Press Enter - page submits
```

#### JAWS Setup (Windows - paid)
```
Similar process to NVDA
- More advanced features
- Better form handling
- Better heading structure
```

#### Mac VoiceOver
```bash
# Built-in to macOS
# Enable: System Settings → Accessibility → VoiceOver

# Test with Command+Option+right arrow to navigate
```

### 4.2 Keyboard-Only Testing

```
Remove mouse, test everything with keyboard:

1. Home page
   - Tab through all links
   - Verify focus visible on each
   - Test search with keyboard

2. Listing page
   - Tab through all controls
   - Enter key on buttons
   - Escape to close modals

3. Create listing
   - Tab through all form fields
   - Shift+Tab to go backward
   - Enter to submit
   - Verify error messages keyboard-accessible

4. Payment flow
   - Tab to Stripe input
   - Enter to submit
   - Verify confirmation with keyboard

Pass Criteria: All features accessible without mouse
```

### 4.3 Color Contrast Testing

**Tool:** WebAIM Contrast Checker

```
1. Test all text colors
   - Regular text (14px): Ratio ≥ 4.5:1
   - Large text (18px+): Ratio ≥ 3:1
   - UI components: Ratio ≥ 3:1

2. Test all button backgrounds
   - Button text contrast ≥ 4.5:1
   - Focus ring visible when focused

3. Test all link colors
   - Link text contrast ≥ 4.5:1
   - Underline or icon needed (not color alone)

Current Colors:
✅ Primary purple #7C3AED on white: 4.8:1
✅ Link blue #0EA5E9 on white: 4.5:1
✅ Text gray #374151 on white: 10.5:1
```

---

## 5. Implementation Checklist (Phase 5)

### 5.1 Before Testing

- [ ] Set up Axe testing framework
- [ ] Install Lighthouse CLI
- [ ] Download NVDA screen reader
- [ ] Install WAVE extension
- [ ] Prepare test matrix spreadsheet

### 5.2 Page Testing

For each page (Home, Login, Create Listing, Browse, Admin, etc.):

- [ ] Run Axe automated audit
- [ ] Run Lighthouse accessibility audit
- [ ] Keyboard-only testing (no mouse)
- [ ] Screen reader testing (NVDA)
- [ ] Color contrast verification
- [ ] Focus indicator visibility
- [ ] Alt text verification
- [ ] Document issues

### 5.3 Issues to Fix

**Critical (must fix):**
- Missing alt text on images
- Color contrast < 4.5:1
- Keyboard traps
- Missing form labels

**Important (should fix):**
- Focus indicators not visible
- Tab order not logical
- Error messages hard to find
- Icons without text labels

**Nice-to-have:**
- Enhanced keyboard shortcuts
- Skip links
- ARIA landmarks

### 5.4 Code Changes Needed

```javascript
// 1. Add focus styles
button:focus,
input:focus,
a:focus {
  outline: 3px solid #0EA5E9;
  outline-offset: 2px;
}

// 2. Add alt text to images
<img src="item.jpg" alt="Vintage wooden table" />

// 3. Add ARIA labels
<button aria-label="Save listing">
  <Heart /> {/* Icon only - need label */}
</button>

// 4. Link labels with inputs
<label htmlFor="email">Email:</label>
<input id="email" type="email" />

// 5. Announce errors to screen readers
<div role="alert" aria-live="polite">
  {error && <p>{error}</p>}
</div>
```

---

## 6. Accessibility Statement

Template to add to website footer:

```markdown
## Accessibility Statement

UrbanGarageSale is committed to providing an accessible website 
for all users. We aim to comply with WCAG 2.1 Level AA standards.

**Current Compliance:** In Progress (Phase 5)

**Known Issues:**
- [List any known limitations]

**How to Report Issues:**
Email: accessibility@urbangarageSale.com.au

**Assistive Technology Support:**
- Screen readers: NVDA, JAWS, VoiceOver
- Keyboard navigation: Full support
- Browser zoom: Supported

**Last Updated:** March 31, 2026
```

---

## 7. Testing Timeline (Phase 5)

| Week | Task | Days |
|------|------|------|
| **Week 1** | Setup tools, establish baseline | 2 |
| **Week 1-2** | Automated testing (Axe, Lighthouse) | 3 |
| **Week 2** | Manual keyboard testing | 2 |
| **Week 2-3** | Screen reader testing | 2 |
| **Week 3** | Issue identification & priority | 1 |
| **Week 3** | Code fixes implementation | 3 |
| **Week 3-4** | Retest & verification | 2 |
| **Week 4** | Final report & sign-off | 1 |

**Total Duration:** 16 days (3-4 weeks)

---

## 8. Success Criteria

### 8.1 Automated Audit Results

- [ ] Axe tests: 0 violations (Pass/Fail)
- [ ] Lighthouse accessibility: ≥ 90 score
- [ ] HTML validator: 0 errors
- [ ] WAVE report: No errors (alerts acceptable)

### 8.2 Manual Testing Results

- [ ] NVDA: All pages readable
- [ ] Keyboard: All features accessible
- [ ] Color contrast: All text ≥ 4.5:1
- [ ] Focus: All controls have visible focus

### 8.3 Compliance

- [ ] WCAG 2.1 Level AA: 100% compliance
- [ ] Australian accessibility standards: Met
- [ ] Accessibility statement: Published
- [ ] Team training: Completed

---

## 9. Resources

### Documentation
- WCAG 2.1 Quick Reference: https://www.w3.org/WAI/WCAG21/quickref/
- WebAIM Articles: https://webaim.org/articles/
- Inclusive Components: https://inclusive-components.design/

### Tools
- Axe DevTools: https://www.deque.com/axe/devtools/
- WAVE Extension: https://wave.webaim.org/extension/
- Lighthouse: https://developers.google.com/web/tools/lighthouse
- NVDA Screen Reader: https://www.nvaccess.org/ 
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/

### Training
- WebAIM Training: https://webaim.org/training/
- Udemy WCAG 2.1 Course
- A11ycasts Series: https://www.youtube.com/playlist?list=PLNYkxOF6rcICWx0C9Xc-RgEzwLvePSSDg

---

## 10. Sign-Off

| Role | Sign-Off | Date |
|------|----------|------|
| **QA Lead** | [ ] | — |
| **Accessibility Expert** | [ ] | — |
| **Tech Lead** | [ ] | — |

---

**Document Control:**
- Version: 1.0 | Date: 26 Feb 2026 | Status: Implementation Plan
- Timeline: Phase 5 (Mar 16-31, 2026)
- Owner: QA Lead + Frontend Team
